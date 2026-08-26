# Arogya FAQ Field Map

## FaqItem
Source Model: `backend-arogya/models/faq/FaqItem.js`

| OLD FIELD | FINAL FIELD | TRANSFORM NOTES |
| :--- | :--- | :--- |
| `_id` | `_id` | Keep original string ID. |
| `question` | `question` | no transform |
| `answer` | `answer` | no transform |
| `image` | `image` | no transform |
| `imageAltText` | `imageAltText` | no transform |
| `order` | `order` | no transform |
| `createdAt` | `createdAt` | Keep original timestamps. |
| `updatedAt` | `updatedAt` | Keep original timestamps. |

## FaqSettings
Source Model: `backend-arogya/models/faq/FaqSettings.js`

| OLD FIELD | FINAL FIELD | TRANSFORM NOTES |
| :--- | :--- | :--- |
| `_id` | `_id` | Keep original string ID. |
| `subheading` | `subheading` | no transform |
| `heading` | `heading` | no transform |
| `highlightText` | `highlightText` | no transform |
| `description` | `description` | no transform |
| `defaultImage` | `defaultImage` | no transform |
| `defaultImageAlt` | `defaultImageAlt` | no transform |
| `leftImage` | `leftImage` | no transform |
| `rightImage` | `rightImage` | no transform |
| `createdAt` | `createdAt` | Keep original timestamps. |
| `updatedAt` | `updatedAt` | Keep original timestamps. |
