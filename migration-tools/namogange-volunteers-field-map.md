# Namo Gange Volunteers Field Map

> **NOTE:** No unique constraint on mobile/email in the source (same issue already found on the Members model). This affects dedup for this collection too.

| OLD FIELD | FINAL FIELD | TRANSFORM NOTES |
| :--- | :--- | :--- |
| `_id` | `_id` | Keep original string ID. |
| `title` | `title` | no transform |
| `applicantName` | `applicantName` | no transform |
| `surname` | `surname` | no transform |
| `fatherName` | `fatherName` | no transform |
| `gender` | `gender` | no transform |
| `qualification` | `qualification` | no transform |
| `occupation` | `occupation` | no transform |
| `organisationType` | `organisationType` | no transform |
| `designation` | `designation` | no transform |
| `dob` | `dob` | no transform |
| `mobile` | `mobile` | no transform |
| `alternateMobile` | `alternateMobile` | no transform |
| `email` | `email` | no transform |
| `aadhaar` | `aadhaar` | no transform |
| `address` | `address` | no transform |
| `country` | `country` | no transform |
| `state` | `state` | no transform |
| `city` | `city` | no transform |
| `pincode` | `pincode` | no transform |
| `emergencyRelation` | `emergencyRelation` | no transform |
| `emergencyContact` | `emergencyContact` | no transform |
| `initiatives` | `initiatives` | no transform |
| `volunteeringFor` | `volunteeringFor` | no transform |
| `networkingFor` | `networkingFor` | no transform |
| `areaOfInterest` | `areaOfInterest` | no transform |
| `monetarySupport` | `monetarySupport` | no transform |
| `reference1` | `reference1` | no transform |
| `reference2` | `reference2` | no transform |
| `areaOfRegion` | `areaOfRegion` | no transform |
| `reportTo` | `reportTo` | no transform |
| `volunteerDesignation` | `volunteerDesignation` | no transform |
| `bankName` | `bankName` | NEW — no equivalent in target schema, needs a decision on whether this becomes a sensitive/encrypted sub-object or is dropped at migration. |
| `accountNo` | `accountNo` | NEW — no equivalent in target schema, needs a decision on whether this becomes a sensitive/encrypted sub-object or is dropped at migration. |
| `ifscCode` | `ifscCode` | NEW — no equivalent in target schema, needs a decision on whether this becomes a sensitive/encrypted sub-object or is dropped at migration. |
| `companyName` | `companyName` | no transform |
| `businessAddress` | `businessAddress` | no transform |
| `businessCountry` | `businessCountry` | no transform |
| `businessState` | `businessState` | no transform |
| `businessCity` | `businessCity` | no transform |
| `businessPincode` | `businessPincode` | no transform |
| `businessDesignation` | `businessDesignation` | no transform |
| `businessContactNo` | `businessContactNo` | no transform |
| `profilePic` | `profilePic` | no transform |
| `createdAt` | `createdAt` | Keep original timestamps. |
| `updatedAt` | `updatedAt` | Keep original timestamps. |
| MISSING FIELD | `status` | MISSING — target schema requires a status, source has none; migration will need a default value decision, do not invent one yourself. |
