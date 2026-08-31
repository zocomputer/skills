# Canvas LMS REST API Reference

Base URL: `https://{CANVAS_URL}/api/v1`

Authentication: `Authorization: Bearer {CANVAS_API_KEY}`

---

## Core Endpoints

### Courses
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses` | List courses for current user |
| GET | `/courses/:id` | Get course details |
| POST | `/courses` | Create a course |
| PUT | `/courses/:id` | Update a course |
| DELETE | `/courses/:id` | Delete a course |
| POST | `/courses/:id/claim` | Claim a course ( conclude ) |
| GET | `/courses/:id/settings` | Get course settings |
| PUT | `/courses/:id/settings` | Update course settings |
| GET | `/courses/:id/activity_stream` | Activity stream |
| GET | `/courses/:id/full_discussion_topic` | Get all discussion topics |

### Enrollments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/enrollments` | List enrollments for a course |
| GET | `/courses/:id/enrollment_terms` | List enrollment terms |
| POST | `/courses/:id/enrollments` | Enroll a user |
| DELETE | `/courses/:id/enrollments/:id` | Unenroll a user |
| PUT | `/courses/:id/enrollments/:id` | Update an enrollment |

### Assignments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/assignments` | List assignments |
| GET | `/courses/:id/assignments/:id` | Get assignment details |
| POST | `/courses/:id/assignments` | Create assignment |
| PUT | `/courses/:id/assignments/:id` | Update assignment |
| DELETE | `/courses/:id/assignments/:id` | Delete assignment |
| GET | `/courses/:id/assignment_groups` | List assignment groups |

### Submissions & Grades
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/students/submissions` | Get multiple submissions |
| GET | `/courses/:id/students/:student_id/submissions/:assignment_id` | Get submission |
| POST | `/courses/:id/students/:student_id/submissions` | Submit assignment |
| PUT | `/courses/:id/students/:student_id/submissions/:assignment_id` | Grade submission |
| GET | `/courses/:id/grades` | Get grades |
| GET | `/courses/:id/grades/:user_id/final` | Get final grade |
| GET | `/courses/:id/submissions/:submission_id/comments` | Get submission comments |

### Announcements
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/announcements` | List announcements |
| POST | `/courses/:id/announcements` | Create announcement |
| PUT | `/courses/:id/announcements/:id` | Update announcement |
| DELETE | `/courses/:id/announcements/:id` | Delete announcement |
| POST | `/courses/:id/announcements/:id/post` | Post announcement |
| POST | `/courses/:id/announcements/:id/delete` | Delete announcement |

### Discussion Topics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/discussion_topics` | List discussion topics |
| GET | `/courses/:id/discussion_topics/:id` | Get discussion topic |
| POST | `/courses/:id/discussion_topics` | Create discussion topic |
| PUT | `/courses/:id/discussion_topics/:id` | Update discussion topic |
| DELETE | `/courses/:id/discussion_topics/:id` | Delete discussion topic |
| POST | `/courses/:id/discussion_topics/:id/entries` | Post reply |

### Modules
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/modules` | List modules |
| GET | `/courses/:id/modules/:id` | Get module |
| POST | `/courses/:id/modules` | Create module |
| PUT | `/courses/:id/modules/:id` | Update module |
| DELETE | `/courses/:id/modules/:id` | Delete module |
| POST | `/courses/:id/modules/:id/items` | Add module item |
| PUT | `/courses/:id/modules/:id/items/:id` | Update module item |
| DELETE | `/courses/:id/modules/:id/items/:id` | Remove module item |
| POST | `/courses/:id/modules/:id/progress` | Mark module done |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/files` | List files |
| GET | `/courses/:id/files/:id` | Get file details |
| POST | `/courses/:id/files` | Upload a file |
| PUT | `/courses/:id/files/:id` | Update file |
| DELETE | `/courses/:id/files/:id` | Delete file |

### Quizzes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/quizzes` | List quizzes |
| GET | `/courses/:id/quizzes/:id` | Get quiz details |
| POST | `/courses/:id/quizzes` | Create quiz |
| PUT | `/courses/:id/quizzes/:id` | Update quiz |
| DELETE | `/courses/:id/quizzes/:id` | Delete quiz |
| GET | `/courses/:id/quizzes/:id/submissions` | Get quiz submissions |
| POST | `/courses/:id/quizzes/:id/submissions` | Take quiz |

### Pages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/pages` | List wiki pages |
| GET | `/courses/:id/pages/:url` | Get a page |
| POST | `/courses/:id/pages` | Create a page |
| PUT | `/courses/:id/pages/:url` | Update a page |
| DELETE | `/courses/:id/pages/:url` | Delete a page |

### Calendar Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/calendar_events` | List calendar events |
| GET | `/calendar_events/:id` | Get calendar event |
| POST | `/calendar_events` | Create calendar event |
| PUT | `/calendar_events/:id` | Update calendar event |
| DELETE | `/calendar_events/:id` | Delete calendar event |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/:id` | Get user profile |
| GET | `/users/:id/profile` | Get user profile details |
| GET | `/users/:id/files` | List user files |
| GET | `/users/:id/enrollments` | List user enrollments |
| GET | `/users/:id/courses` | List courses for a user |
| GET | `/users/:id/avatar` | Get user avatar |

### Grades (Gradebook)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/gradebook` | Get gradebook |
| GET | `/courses/:id/gradebook/final_grades` | Get final grades |
| GET | `/courses/:id/grades/:user_id` | Get user's grades |

### Outcome Results
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/courses/:id/outcomes` | List course outcomes |
| GET | `/courses/:id/outcome_results` | Get outcome results |

### Progress
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/progress/:id` | Get progress |
| GET | `/courses/:id/progress` | Get course progress |

---

## Pagination
All list endpoints support pagination via query params:
- `per_page=100` — items per page (max typically 100)
- `page=2` — page number

Returns `Link` header with next/prev/first/last URLs.

---

## Error Codes
| Code | Meaning |
|------|---------|
| 400 | Bad Request |
| 401 | Unauthorized (invalid or missing token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 422 | Unprocessable Entity |
| 500 | Internal Server Error |

---

## Rate Limiting
Canvas APIs are rate-limited. Use response headers:
- `X-Rate-Limit-Remaining` — remaining requests
- `X-Rate-Limit-Reset` — reset timestamp

---

## Query Parameters
Common params across most endpoints:
- `include[]` — e.g., `include[]=total_scores&include[]=current_grades`
- `exclude[]` — exclude fields from response
- `state[]` — filter by state
- `published` — filter by published status
