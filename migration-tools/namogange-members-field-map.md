| OLD FIELD | FINAL FIELD | TRANSFORM NOTES |
| :--- | :--- | :--- |
| `_id` | `_id` | Keep original string ID. |
| `title` | `title` | no transform |
| `applicantName` | `applicantName` | no transform |
| `surname` | `surname` | no transform |
| `fatherMotherSpouseName` | `fatherMotherSpouseName` | no transform |
| `gender` | `gender` | no transform |
| `qualification` | `qualification` | no transform |
| `occupation` | `occupation` | no transform |
| `organizationType` | `organizationType` | no transform |
| `designation` | `designation` | no transform |
| `dob` | `dob` | no transform |
| `mobile` | `mobile` | no transform |
| `alternateNo` | `alternateNo` | no transform |
| `email` | `email` | no transform |
| `aadharNo` | `aadharNo` | UNKNOWN — needs review (determine encryption/hashing policy for PII going forward) |
| `address` | `address` | no transform |
| `country` | `country` | no transform |
| `state` | `state` | no transform |
| `city` | `city` | no transform |
| `pinCode` | `pinCode` | no transform |
| `bloodGroup` | `bloodGroup` | no transform |
| `relation` | `relation` | no transform |
| `emergencyContact` | `emergencyContact` | no transform |
| `initiatives` | `initiatives` | no transform |
| `volunteeringFor` | `volunteeringFor` | no transform |
| `networkingFor` | `networkingFor` | no transform |
| `areaOfInterest` | `areaOfInterest` | no transform |
| `monetarySupport` | `monetarySupport` | no transform |
| `reference1` | `reference1` | UNKNOWN — needs review (confirm if nested shape is acceptable or needs flat/subdoc mapping) |
| `reference2` | `reference2` | UNKNOWN — needs review (confirm if nested shape is acceptable or needs flat/subdoc mapping) |
| `profilePic` | `profilePic` | no transform |
| `createdAt` | `createdAt` | Keep original timestamps. |
| `updatedAt` | `updatedAt` | Keep original timestamps. |
