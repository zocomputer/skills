# n8n Workflow JSON Schema — Reference สำหรับ Generate ที่ Valid

## โครงสร้างหลัก (Root Object)

```json
{
  "name": "ชื่อ Workflow",
  "active": false,
  "nodes": [ ...array of node objects... ],
  "connections": { ...connection map... },
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null
}
```

> หมายเหตุ: ไม่ต้องใส่ `id` และ `versionId` ตอน generate ใหม่ n8n จะ assign ให้เอง

---

## Node Object Structure

```json
{
  "id": "uuid-v4-string",
  "name": "ชื่อ Node (แสดงบน canvas)",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [240, 300],
  "parameters": { ...ขึ้นอยู่กับ type... },
  "credentials": {
    "credentialTypeName": {
      "id": "credential-id",
      "name": "ชื่อ Credential"
    }
  }
}
```

**กฎ position:**
- เริ่มต้น: `[240, 300]`
- เพิ่มทีละ: `[+250, 0]` (แนวนอน) หรือ `[0, +150]` (แนวตั้ง)
- Branch: `[+250, -150]` และ `[+250, +150]`

---

## Connections Structure

```json
{
  "connections": {
    "ชื่อ Node ต้นทาง": {
      "main": [
        [
          {
            "node": "ชื่อ Node ปลายทาง",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

**Branch (IF node):**
```json
"IF": {
  "main": [
    [ { "node": "True Branch Node", "type": "main", "index": 0 } ],
    [ { "node": "False Branch Node", "type": "main", "index": 0 } ]
  ]
}
```

---

## Node Types และ Parameters ที่ใช้บ่อย

### 1. Webhook Trigger
```json
{
  "id": "uuid-1",
  "name": "Webhook",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "position": [240, 300],
  "parameters": {
    "httpMethod": "POST",
    "path": "my-webhook-path",
    "responseMode": "onReceived",
    "responseData": "allEntries"
  }
}
```

### 2. Schedule Trigger
```json
{
  "id": "uuid-1",
  "name": "Schedule Trigger",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "position": [240, 300],
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "0 9 * * 1-5"
        }
      ]
    }
  }
}
```

### 3. Manual Trigger
```json
{
  "id": "uuid-1",
  "name": "When clicking 'Test workflow'",
  "type": "n8n-nodes-base.manualTrigger",
  "typeVersion": 1,
  "position": [240, 300],
  "parameters": {}
}
```

### 4. Gmail Trigger
```json
{
  "id": "uuid-1",
  "name": "Gmail Trigger",
  "type": "n8n-nodes-base.gmailTrigger",
  "typeVersion": 1,
  "position": [240, 300],
  "parameters": {
    "pollTimes": {
      "item": [{ "mode": "everyMinute" }]
    },
    "filters": {}
  },
  "credentials": {
    "gmailOAuth2": { "id": "1", "name": "Gmail account" }
  }
}
```

### 5. AI Agent Node
```json
{
  "id": "uuid-5",
  "name": "AI Agent",
  "type": "@n8n/n8n-nodes-langchain.agent",
  "typeVersion": 1.7,
  "position": [740, 300],
  "parameters": {
    "promptType": "define",
    "text": "={{ $json.message }}",
    "options": {
      "systemMessage": "You are a helpful assistant."
    }
  }
}
```

### 6. OpenAI Chat Model (sub-node ของ AI Agent)
```json
{
  "id": "uuid-6",
  "name": "OpenAI Chat Model",
  "type": "@n8n/n8n-nodes-langchain.lmChatOpenAi",
  "typeVersion": 1.2,
  "position": [740, 480],
  "parameters": {
    "model": "gpt-4o-mini",
    "options": {
      "temperature": 0.7
    }
  },
  "credentials": {
    "openAiApi": { "id": "2", "name": "OpenAI account" }
  }
}
```

**Connection สำหรับ sub-node (ai_languageModel):**
```json
"OpenAI Chat Model": {
  "ai_languageModel": [
    [{ "node": "AI Agent", "type": "ai_languageModel", "index": 0 }]
  ]
}
```

### 7. HTTP Request
```json
{
  "id": "uuid-7",
  "name": "HTTP Request",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [490, 300],
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/endpoint",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpBearerAuth",
    "sendBody": true,
    "bodyParameters": {
      "parameters": [
        { "name": "key", "value": "={{ $json.value }}" }
      ]
    }
  }
}
```

### 8. Google Sheets - Read
```json
{
  "id": "uuid-8",
  "name": "Google Sheets",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "position": [490, 300],
  "parameters": {
    "operation": "read",
    "documentId": {
      "__rl": true,
      "value": "YOUR_SHEET_ID",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Sheet1",
      "mode": "name"
    }
  },
  "credentials": {
    "googleSheetsOAuth2Api": { "id": "3", "name": "Google Sheets account" }
  }
}
```

### 9. Google Sheets - Append
```json
{
  "id": "uuid-9",
  "name": "Append to Sheets",
  "type": "n8n-nodes-base.googleSheets",
  "typeVersion": 4.5,
  "position": [990, 300],
  "parameters": {
    "operation": "append",
    "documentId": {
      "__rl": true,
      "value": "YOUR_SHEET_ID",
      "mode": "id"
    },
    "sheetName": {
      "__rl": true,
      "value": "Sheet1",
      "mode": "name"
    },
    "columns": {
      "mappingMode": "autoMapInputData",
      "value": {}
    }
  },
  "credentials": {
    "googleSheetsOAuth2Api": { "id": "3", "name": "Google Sheets account" }
  }
}
```

### 10. Send Gmail
```json
{
  "id": "uuid-10",
  "name": "Send Email",
  "type": "n8n-nodes-base.gmail",
  "typeVersion": 2.1,
  "position": [990, 300],
  "parameters": {
    "operation": "send",
    "toList": "={{ $json.email }}",
    "subject": "แจ้งผลการจอง",
    "emailType": "text",
    "message": "={{ $json.message }}"
  },
  "credentials": {
    "gmailOAuth2": { "id": "1", "name": "Gmail account" }
  }
}
```

### 11. Set Node (กำหนดค่าตัวแปร)
```json
{
  "id": "uuid-11",
  "name": "Set Variables",
  "type": "n8n-nodes-base.set",
  "typeVersion": 3.4,
  "position": [490, 300],
  "parameters": {
    "mode": "manual",
    "assignments": {
      "assignments": [
        {
          "id": "field-1",
          "name": "result",
          "value": "={{ $json.data }}",
          "type": "string"
        }
      ]
    }
  }
}
```

### 12. IF Node (แยก branch)
```json
{
  "id": "uuid-12",
  "name": "Check Condition",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2.2,
  "position": [740, 300],
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict"
      },
      "conditions": [
        {
          "id": "cond-1",
          "leftValue": "={{ $json.status }}",
          "rightValue": "success",
          "operator": {
            "type": "string",
            "operation": "equals"
          }
        }
      ],
      "combinator": "and"
    }
  }
}
```

### 13. Code Node (JavaScript)
```json
{
  "id": "uuid-13",
  "name": "Process Data",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [740, 300],
  "parameters": {
    "jsCode": "const items = $input.all();\nreturn items.map(item => ({\n  json: {\n    ...item.json,\n    processed: true,\n    timestamp: new Date().toISOString()\n  }\n}));"
  }
}
```

### 14. Telegram - Send Message
```json
{
  "id": "uuid-14",
  "name": "Send Telegram",
  "type": "n8n-nodes-base.telegram",
  "typeVersion": 1.2,
  "position": [990, 300],
  "parameters": {
    "operation": "sendMessage",
    "chatId": "={{ $json.chatId }}",
    "text": "={{ $json.message }}",
    "additionalFields": {
      "parse_mode": "HTML"
    }
  },
  "credentials": {
    "telegramApi": { "id": "4", "name": "Telegram Bot" }
  }
}
```

### 15. Telegram Trigger
```json
{
  "id": "uuid-1",
  "name": "Telegram Trigger",
  "type": "n8n-nodes-base.telegramTrigger",
  "typeVersion": 1.1,
  "position": [240, 300],
  "parameters": {
    "updates": ["message"],
    "additionalFields": {}
  },
  "credentials": {
    "telegramApi": { "id": "4", "name": "Telegram Bot" }
  }
}
```

### 16. Window Buffer Memory (สำหรับ AI Agent)
```json
{
  "id": "uuid-16",
  "name": "Window Buffer Memory",
  "type": "@n8n/n8n-nodes-langchain.memoryBufferWindow",
  "typeVersion": 1.3,
  "position": [740, 480],
  "parameters": {
    "contextWindowLength": 10
  }
}
```

**Connection (ai_memory sub-node):**
```json
"Window Buffer Memory": {
  "ai_memory": [
    [{ "node": "AI Agent", "type": "ai_memory", "index": 0 }]
  ]
}
```

### 17. Sticky Note (คำอธิบาย)
```json
{
  "id": "uuid-17",
  "name": "Sticky Note",
  "type": "n8n-nodes-base.stickyNote",
  "typeVersion": 1,
  "position": [100, 200],
  "parameters": {
    "content": "## วิธีใช้\n1. ใส่ API Key ใน Credentials\n2. แก้ Sheet ID\n3. กด Activate",
    "height": 200,
    "width": 300,
    "color": 3
  }
}
```

---

## Credentials ที่พบบ่อย

| Service | credentialType | fields |
|---------|---------------|--------|
| OpenAI | `openAiApi` | apiKey |
| Gmail | `gmailOAuth2` | OAuth flow |
| Google Sheets | `googleSheetsOAuth2Api` | OAuth flow |
| Telegram | `telegramApi` | accessToken |
| Slack | `slackApi` | accessToken |
| LINE | `lineNotifyApi` | accessToken |
| Airtable | `airtableTokenApi` | apiKey |
| Anthropic | `anthropicApi` | apiKey |

---

## ตัวอย่าง Expression ที่ใช้บ่อย

```javascript
// รับค่าจาก node ก่อนหน้า
{{ $json.fieldName }}

// รับค่าจาก node เฉพาะ
{{ $('Node Name').item.json.fieldName }}

// วันเวลาปัจจุบัน
{{ $now.toISO() }}
{{ $now.format('DD/MM/YYYY') }}

// ต่อ string
{{ 'สวัสดี ' + $json.name }}

// เงื่อนไข
{{ $json.status === 'active' ? 'ใช้งาน' : 'ปิด' }}

// Loop item index
{{ $itemIndex }}

// Input ทั้งหมด
{{ $input.all() }}
```

---

## Common Errors และวิธีแก้

| Error | สาเหตุ | วิธีแก้ |
|-------|--------|---------|
| `unknown node type` | typeVersion ผิด | ใช้ typeVersion จาก schema นี้ |
| `Credentials not found` | credential id ไม่มีในระบบ | เปิด workflow แล้วเลือก credential ใหม่ |
| `Cannot read property of undefined` | expression ผิด path | ตรวจ field name ใน JSON output |
| `Workflow could not be activated` | Trigger node config ผิด | ตรวจ parameters ของ trigger |
