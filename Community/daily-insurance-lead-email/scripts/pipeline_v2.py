#!/usr/bin/env python3
"""
Daily Insurance Lead Email Pipeline v2
========================================
3-Step Apify flow:
1. LinkedIn Search (HarvestAPI) → profile URLs
2. LinkedIn Email Finder (Vulnv) → emails from profile URLs
3. Email Verifier → verified emails

Then: Dedup → Brevo send → Cost report
"""
import json, os, time, re, requests
from datetime import datetime
from pathlib import Path

# === Config ===
SKILL_DIR = Path(__file__).parent.parent
with open(SKILL_DIR / 'data' / 'config.json') as f:
    config = json.load(f)

DATA_DIR = SKILL_DIR / 'data'
SENT_FILE = DATA_DIR / 'sent_emails.json'
COST_FILE = DATA_DIR / 'costs.json'
TEMPLATE_PATH = SKILL_DIR / 'assets' / 'email_template.html'

APIFY_KEY = os.environ['APIFY_API_KEY']
BREVO_KEY = os.environ['BREVO_API_KEY']

TARGET = config['pipeline']['target_count']  # 100
BREVO_LIST_ID = config['brevo']['list_id']
SENDER_EMAIL = config['sender']['email']
SENDER_NAME = config['sender']['name']

# Cost config
APIFY_CU_COST = config['costs']['apify']['compute_unit_usd']
EMAIL_FINDER_COST = config['costs']['apify'].get('email_finder_cost_per_found', 0.026)
VERIFIER_COST_PER = config['costs']['apify'].get('verifier_cost_per_email', 0.001)

# Actor IDs
SEARCH_ACTOR_ID = config['apify']['lead_actor_id']        # HarvestAPI LinkedIn Search
EMAIL_FINDER_ACTOR_ID = config['apify']['email_finder_actor_id']  # Vulnv Email Finder
VERIFIER_ACTOR_ID = config['apify']['email_verifier_actor_id']    # Email Verifier

NOW = datetime.now()
TODAY = NOW.strftime('%Y-%m-%d')

# YouTube info
YT = config['youtube']
VIDEO_TITLE = YT['video_title']
YT_URL = YT['channel_url']
YT_NAME = YT['channel_name']

def log(msg):
    print(f"[{NOW.strftime('%H:%M:%S')}] {msg}")

# === Sent emails & costs tracking ===
def load_sent_emails():
    if SENT_FILE.exists():
        return set(json.load(open(SENT_FILE)))
    return set()

def save_sent_emails(emails_set):
    json.dump(sorted(list(emails_set)), open(SENT_FILE, 'w'), indent=2)

def load_costs():
    if COST_FILE.exists():
        costs = json.load(open(COST_FILE))
    else:
        costs = {'daily': [], 'total_apify_usd': 0, 'total_brevo_emails': 0}
    return costs

def save_costs(costs):
    json.dump(costs, open(COST_FILE, 'w'), indent=2)

# === Apify Helpers ===
def run_apify_actor(actor_id, payload, label='Actor'):
    """Run an Apify actor and wait for completion. Returns (run_id, run_data)."""
    url = f'https://api.apify.com/v2/acts/{actor_id}/runs?token={APIFY_KEY}'
    resp = requests.post(url, json=payload)
    if resp.status_code != 201:
        log(f'  ❌ {label} start failed: {resp.status_code} {resp.text[:200]}')
        return None, None
    
    run_data = resp.json()
    run_id = run_data['data']['id']
    log(f'  🔄 {label} run started: {run_id}')
    
    for i in range(120):  # Max 10 min
        time.sleep(5)
        status_resp = requests.get(
            f'https://api.apify.com/v2/acts/{actor_id}/runs/{run_id}?token={APIFY_KEY}'
        )
        status_data = status_resp.json()
        status = status_data['data']['status']
        
        if status == 'SUCCEEDED':
            log(f'  ✅ {label} completed')
            return run_id, status_data['data']
        elif status in ('FAILED', 'ABORTED', 'TIMED-OUT'):
            log(f'  ❌ {label} {status}')
            return run_id, status_data['data']
        
        if i % 12 == 0 and i > 0:
            log(f'  ⏳ {label} still running... ({status})')
    
    log(f'  ⚠️ {label} timed out after 10 min')
    return run_id, None

def get_dataset_items(dataset_id):
    """Fetch dataset items."""
    url = f'https://api.apify.com/v2/datasets/{dataset_id}/items?token={APIFY_KEY}&clean=true&format=json'
    return requests.get(url).json()

def extract_cu(run_data):
    """Extract compute units from run data."""
    return run_data.get('stats', {}).get('computeUnits', 0) if run_data else 0

# === Step 1: LinkedIn Search ===
def step1_search():
    """Find HK insurance agents via LinkedIn search."""
    log('🔍 Step 1: LinkedIn Search (HarvestAPI)...')
    
    payload = {
        'searchUrl': 'https://www.linkedin.com/search/results/people/?keywords=insurance%20agent%20Hong%20Kong',
        'maxResults': TARGET * 2,  # Get more than needed, filter later
    }
    
    run_id, run_data = run_apify_actor(SEARCH_ACTOR_ID, payload, 'LinkedIn Search')
    if not run_data:
        return [], 0, 0
    
    cu = extract_cu(run_data)
    dataset_id = run_data['defaultDatasetId']
    items = get_dataset_items(dataset_id)
    
    log(f'  📊 Search found {len(items)} profiles')
    
    # Extract profile URLs that look like HK insurance agents
    profile_urls = []
    for item in items[:TARGET * 2]:
        url = item.get('linkedinUrl', '') or item.get('linkedinProfileUrl', '')
        if url and '/in/' in url:
            profile_urls.append(url)
    
    log(f'  🔗 Extracted {len(profile_urls)} profile URLs')
    return profile_urls, cu, len(items)

# === Step 2: Email Finder ===
def step2_find_emails(profile_urls, sent_set):
    """Find emails from LinkedIn profiles."""
    if not profile_urls:
        return [], 0
    
    # Limit to what we need
    urls_to_process = profile_urls[:TARGET * 2]
    log(f'🔍 Step 2: Email Finder ({len(urls_to_process)} profiles)...')
    
    payload = {'urls': urls_to_process}
    run_id, run_data = run_apify_actor(EMAIL_FINDER_ACTOR_ID, payload, 'Email Finder')
    if not run_data:
        return [], 0
    
    cu = extract_cu(run_data)
    dataset_id = run_data['defaultDatasetId']
    items = get_dataset_items(dataset_id)
    
    # Filter: HK-related + has email + not already sent
    leads = []
    found_count = 0
    for item in items:
        if item.get('found') and item.get('email'):
            email = item['email'].lower()
            if email not in sent_set:
                name = item.get('name', '')
                leads.append({
                    'name': name,
                    'email': email,
                    'domain': item.get('domain', ''),
                    'company': item.get('company', ''),
                    'source': 'apify_email_finder'
                })
                found_count += 1
                if len(leads) >= TARGET:
                    break
    
    log(f'  📧 Emails found: {found_count}, new leads: {len(leads)}')
    return leads, cu

# === Step 3: Email Verification ===
def step3_verify(leads):
    """Verify emails via Apify Email Verifier."""
    if not leads:
        return [], 0
    
    emails = [l['email'] for l in leads]
    log(f'🔍 Step 3: Email Verification ({len(emails)} emails)...')
    
    payload = {
        'emails': emails,
        'verifyCatchAll': True,
    }
    
    run_id, run_data = run_apify_actor(VERIFIER_ACTOR_ID, payload, 'Email Verifier')
    if not run_data:
        # If verification fails, return all as-is (best effort)
        log('  ⚠️ Verification failed, using all emails as-is')
        return leads, 0
    
    cu = extract_cu(run_data)
    dataset_id = run_data['defaultDatasetId']
    items = get_dataset_items(dataset_id)
    
    # Build verification map
    verify_map = {}
    for item in items:
        # The verifier returns various status fields
        email = item.get('email', '').lower()
        if not email:
            continue
        
        # Check different status fields that different verifiers use
        status = (item.get('status', '') or 
                  item.get('email_status', '') or 
                  item.get('result', '') or 
                  item.get('verification_status', ''))
        is_valid = (
            status.upper() in ('VALID', 'OK', 'DELIVERABLE', 'ACCEPT_ALL') or
            item.get('isValid') == True or
            item.get('valid') == True or
            item.get('smtpCheck') == True or
            item.get('deliverable') == True
        )
        verify_map[email] = is_valid
    
    valid_leads = []
    for lead in leads:
        email = lead['email']
        is_valid = verify_map.get(email, True)  # Default to True if not in results
        if is_valid:
            valid_leads.append(lead)
    
    log(f'  ✅ Verified: {len(valid_leads)}/{len(leads)} valid')
    return valid_leads, cu

# === Step 4: Brevo Send ===
def step4_send(leads, sent_set):
    """Send emails via Brevo transactional API + add contacts to list."""
    if not leads:
        log('  📭 No leads to send')
        return 0, []
    
    # Read email template
    if TEMPLATE_PATH.exists():
        html_template = TEMPLATE_PATH.read_text()
    else:
        html_template = f'<p>{VIDEO_TITLE}</p><p>Watch: {YT_URL}</p>'
    
    # Replace template variables
    html_content = html_template.replace('{{video_title}}', VIDEO_TITLE)
    html_content = html_content.replace('{{video_url}}', config['youtube']['video_url'])
    html_content = html_content.replace('{{youtube_channel}}', YT_NAME)
    html_content = html_content.replace('{{youtube_channel_url}}', YT_URL)
    html_content = html_content.replace('{{contact_email}}', SENDER_EMAIL)
    html_content = html_content.replace('{{sender_name}}', SENDER_NAME)
    
    email_subject = f'{VIDEO_TITLE[:80]}'
    
    log(f'📧 Step 4: Sending {len(leads)} emails via Brevo...')
    
    sent = 0
    errors = []
    new_leads_added = []
    
    for i, lead in enumerate(leads):
        try:
            # Send transactional email
            resp = requests.post(
                'https://api.brevo.com/v3/smtp/email',
                headers={
                    'api-key': BREVO_KEY,
                    'Content-Type': 'application/json',
                },
                json={
                    'sender': {'name': SENDER_NAME, 'email': SENDER_EMAIL},
                    'to': [{'email': lead['email'], 'name': lead.get('name', '')}],
                    'subject': email_subject,
                    'htmlContent': html_content,
                }
            )
            
            if resp.status_code in (200, 201):
                sent += 1
                sent_set.add(lead['email'])
                new_leads_added.append(lead)
            else:
                errors.append(f'{lead["email"]}: {resp.status_code}')
                # Even if send fails, still try to add to list
                
            # Throttle: Brevo free tier rate limit
            time.sleep(0.1)
            
        except Exception as e:
            errors.append(f'{lead["email"]}: {str(e)}')
        
        if (i + 1) % 25 == 0:
            log(f'  📤 Progress: {i+1}/{len(leads)}')
    
    # Add contacts to Brevo list
    if new_leads_added:
        try:
            contacts_payload = {
                'listIds': [BREVO_LIST_ID],
                'updateEnabled': True,
                'contacts': [
                    {'email': l['email'], 'attributes': {
                        'FIRSTNAME': l.get('name', ''),
                        'SOURCE': l.get('source', ''),
                    }}
                    for l in new_leads_added[:100]
                ]
            }
            requests.post(
                'https://api.brevo.com/v3/contacts/import',
                headers={'api-key': BREVO_KEY, 'Content-Type': 'application/json'},
                json=contacts_payload
            )
        except Exception as e:
            log(f'  ⚠️ Failed to add contacts to list: {e}')
    
    log(f'  ✅ Sent: {sent}/{len(leads)}, Errors: {len(errors)}')
    return sent, errors

# === Main Pipeline ===
def main():
    log('=' * 60)
    log('🚀 Daily Insurance Lead Email Pipeline v2')
    log('=' * 60)
    
    sent_set = load_sent_emails()
    costs = load_costs()
    log(f'📋 Already sent: {len(sent_set)} emails')
    
    today_cost = {
        'date': TODAY,
        'search_cu': 0,
        'search_cost_usd': 0,
        'email_finder_cu': 0,
        'email_finder_found': 0,
        'email_finder_cost_usd': 0,
        'verifier_cu': 0,
        'verifier_emails': 0,
        'verifier_cost_usd': 0,
        'brevo_emails': 0,
        'brevo_cost_usd': 0,
        'total_cost_usd': 0,
    }
    
    # Step 1: Search
    profile_urls, search_cu, total_found = step1_search()
    today_cost['search_cu'] = search_cu
    today_cost['search_cost_usd'] = round(search_cu * APIFY_CU_COST, 4)
    
    if not profile_urls:
        log('❌ No profiles found, exiting')
        return
    
    # Step 2: Find emails from profiles
    leads, finder_cu = step2_find_emails(profile_urls, sent_set)
    today_cost['email_finder_cu'] = finder_cu
    
    # Cost: CU-based + per-email-found
    emails_found = len(leads)
    today_cost['email_finder_found'] = emails_found
    # The email finder charges per email found, not CU
    today_cost['email_finder_cost_usd'] = round(
        finder_cu * APIFY_CU_COST + emails_found * EMAIL_FINDER_COST, 4
    )
    
    if not leads:
        log('❌ No emails found, exiting')
        return
    
    # Step 3: Verify
    valid_leads, verifier_cu = step3_verify(leads)
    today_cost['verifier_cu'] = verifier_cu
    today_cost['verifier_emails'] = len(valid_leads)
    today_cost['verifier_cost_usd'] = round(
        verifier_cu * APIFY_CU_COST + len(valid_leads) * VERIFIER_COST_PER, 4
    )
    
    if not valid_leads:
        log('❌ No valid emails after verification, exiting')
        return
    
    # Step 4: Send
    sent, errors = step4_send(valid_leads, sent_set)
    today_cost['brevo_emails'] = sent
    
    # Brevo cost: free up to 300/day, then $0.00125/email
    free_limit = config['costs']['brevo']['free_daily_limit']
    paid_count = max(0, sent - free_limit)
    today_cost['brevo_cost_usd'] = round(paid_count * config['costs']['brevo']['cost_per_email_usd'], 4)
    
    # Total
    today_cost['total_cost_usd'] = round(
        today_cost['search_cost_usd'] +
        today_cost['email_finder_cost_usd'] +
        today_cost['verifier_cost_usd'] +
        today_cost['brevo_cost_usd'],
        4
    )
    
    # Save state
    save_sent_emails(sent_set)
    costs['daily'].append(today_cost)
    costs['total_apify_usd'] = round(costs['total_apify_usd'] + today_cost['total_cost_usd'], 4)
    costs['total_brevo_emails'] += sent
    save_costs(costs)
    
    # Summary
    log('=' * 60)
    log('📊 PIPELINE SUMMARY')
    log('=' * 60)
    log(f'  🔍 Search: {total_found} profiles (CU: {search_cu:.4f}, ${today_cost["search_cost_usd"]:.4f})')
    log(f'  📧 Email Finder: {emails_found} emails (CU: {finder_cu:.4f} + per-email, ${today_cost["email_finder_cost_usd"]:.4f})')
    log(f'  ✅ Verified: {len(valid_leads)}/{len(leads)} (CU: {verifier_cu:.4f}, ${today_cost["verifier_cost_usd"]:.4f})')
    log(f'  📨 Brevo Sent: {sent}/{len(valid_leads)} (${today_cost["brevo_cost_usd"]:.4f})')
    log(f'  ---')
    log(f'  💰 TODAY TOTAL: ${today_cost["total_cost_usd"]:.4f}')
    log(f'  📈 All-time sent: {len(sent_set)} emails | Total cost: ${costs["total_apify_usd"]:.4f}')
    
    if errors:
        log(f'  ⚠️ Failed sends: {errors[:5]}')
    
    return sent, len(sent_set), today_cost['total_cost_usd']

if __name__ == '__main__':
    main()
