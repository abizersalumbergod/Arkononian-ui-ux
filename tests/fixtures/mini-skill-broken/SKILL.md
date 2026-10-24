---
name: Mini_Skill Broken
description: ""
---

# Mini skill (broken fixture)

Intentionally broken package for tests/skill-structure.test.mjs. Each defect must be detected:

1. Bad front matter: the name has uppercase letters, an underscore and a space; the description is empty.
2. Missing file: MASTER_INSTRUCTIONS.md is absent.
3. Broken link: references/alpha.md links to a module that does not exist.
4. Fake secret: references/beta.md contains the AWS documentation example access key id.

- [Alpha reference](references/alpha.md)
- [Demo workflow](workflows/demo-flow.md)
