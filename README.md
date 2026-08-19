# Family Roots Chronicle

You are a senior full-stack engineer and product designer.

I want you to build V1 of a private Family Tree web application.

## 1. PRODUCT PURPOSE

This application is for documenting and exploring a large family tree.

The family tree currently starts from:

Yonis

└── Ahmed

Ahmed is the first son of Yonis.

Ahmed has 17 children/branches:

1. Abdosh

2. Fatuma

3. Khedra

4. Sefiya

5. Meymuna

6. Abdusemed

7. Abdulmanan

8. Amina

9. Ametulla

10. Kimya

11. Nejuma

12. Abduletif

13. Abdulhanan

14. Hafiza

15. Abdurehim

16. Alfuleyla

17. Tenber

The database will continue growing as more family members and descendants are collected.

IMPORTANT:

Do not invent family relationships, names, dates, spouses, or other genealogical information.

Only use information explicitly provided in the dataset.

If something is unknown, leave it empty or mark it as unknown.

---

# 2. V1 OBJECTIVE

The goal of V1 is simple:

A user should be able to:

1. Open the family tree.

2. Navigate through generations.

3. Expand and collapse branches.

4. Search for any person.

5. Open a person's profile.

6. See their parents, siblings, and children.

7. Navigate from one person to another through relationships.

8. View a specific family branch.

9. Admin can add and edit people and relationships.

10. Preserve the family data safely.

Do NOT build unnecessary social or community features in V1.

---

# 3. TECH STACK

Use:

Frontend:

- React

- Vite

- TypeScript

- Tailwind CSS

Tree visualization:

- React Flow or another well-maintained React tree visualization library

Backend:

- Node.js

- Express

- TypeScript

Database:

- PostgreSQL

ORM:

- Prisma

Authentication:

- Simple admin authentication for V1

Do not introduce unnecessary technologies unless there is a strong technical reason.

---

# 4. DATABASE DESIGN

Do NOT store the entire family tree as one giant nested JSON object.

The data must be relational.

At minimum create:

## Person

Fields:

- id

- firstName

- middleName

- lastName

- displayName

- gender

- birthDate

- deathDate

- photoUrl

- notes

- createdAt

- updatedAt

Keep optional fields nullable.

## ParentChild

Fields:

- id

- parentId

- childId

- relationshipType

- createdAt

This allows one person to have parents and children without hardcoding the tree structure.

## Marriage

For V1, create the basic structure but do not make marriage functionality complicated.

Fields:

- id

- person1Id

- person2Id

- marriageDate

- notes

## AdminUser

Fields:

- id

- email

- passwordHash

- createdAt

Design the schema so future features such as photos, stories, sources, verification, and family contributions can be added without restructuring the whole system.

---

# 5. MAIN UI

The application should have a clean, elegant genealogy-oriented design.

Main navigation:

- 🌳 Family Tree

- 🔎 Search

- 👥 People

- 📊 Statistics

- ⚙️ Admin

Keep the interface simple.

The family tree should be the primary experience.

---

# 6. FAMILY TREE VIEW

Create an interactive visual family tree.

Requirements:

- Zoom

- Pan

- Expand/collapse branches

- Click a person

- Show relationships clearly

- Navigate between generations

- Highlight the selected person

- Avoid rendering the entire huge tree expanded at once

When the user opens the application, show the root:

Yonis

↓

Ahmed

Then allow the user to expand Ahmed's branches.

For example:

Ahmed

├── Abdosh

├── Fatuma

├── Khedra

├── Sefiya

├── Meymuna

└── ...

Clicking Abdosh should allow the user to explore his descendants.

The tree must remain usable when hundreds or thousands of people are eventually added.

---

# 7. PERSON PROFILE

When clicking a person, open a profile panel or dedicated page.

Example:

PERSON:

Abdosh

Parent:

Ahmed

Children:

15

Sections:

- Basic information

- Parents

- Siblings

- Spouse(s)

- Children

- Notes

Each related person should be clickable.

Example:

Abdosh

Parent:

→ Ahmed

Children:

→ Rewda

→ Kemya

→ Maria

→ Yonis

...

Clicking a person should navigate to that person's profile/tree position.

---

# 8. SEARCH

Search must be fast and simple.

Search by:

- Name

- Partial name

Example:

Search:

"Humeyda"

Result:

Humeyda

Khedra → Ayneb → Humeyda

Clicking the result should:

1. Open the person's profile.

2. Show their position in the family tree.

3. Highlight their branch.

The search system must work well with hundreds or thousands of people.

---

# 9. BRANCH VIEW

Users should be able to focus on one branch.

Example:

Ahmed

→ Khedra

Then display:

Khedra

├── Tofik

│ ├── Sami

│ ├── Nejwa

│ ├── Remzi

│ └── Mohamed

├── Ahmed

│ ├── Abdulmenan

│ └── Zein

├── Yusuf

│ ├── Semir

│ ├── Semiha

│ └── Sitra

...

The user should be able to expand deeper levels.

---

# 10. PEOPLE PAGE

Create a searchable people directory.

Display:

- Name

- Parent

- Number of children

- Branch

- Generation

Include:

- Search

- Sorting

- Pagination

Example:

| Name | Parent | Children | Branch |

|------|--------|----------|--------|

| Abdosh | Ahmed | 15 | Ahmed |

| Khedra | Ahmed | 11 | Ahmed |

| Tofik | Khedra | 4 | Khedra |

---

# 11. STATISTICS

Keep statistics simple.

Show:

- Total people

- Total generations

- Total family branches

- People with children

- People without children

Also show descendant counts for Ahmed's branches.

Example:

Abdosh → 40+ descendants currently recorded

Khedra → 30+ descendants currently recorded

etc.

These numbers should be calculated dynamically from the database.

Do NOT hardcode statistics.

---

# 12. ADMIN PANEL

Only the administrator can modify the family tree in V1.

Admin must be able to:

### People

- Add person

- Edit person

- Delete person

- Search person

### Relationships

- Add parent-child relationship

- Remove relationship

- Add spouse relationship

### Data correction

The family tree is actively being researched, so names and relationships may need corrections.

Make editing easy.

Before deleting a person or relationship, show confirmation.

Avoid accidental destructive operations.

---

# 13. DATA IMPORT

Create a simple seed/import system so the current family data can be inserted into PostgreSQL.

Do not manually hardcode the tree inside React components.

The UI must read from the database/API.

Structure:

React

↓

Express API

↓

Prisma

↓

PostgreSQL

---

# 14. CURRENT FAMILY DATA

Use the following as the initial dataset.

Yonis

└── Ahmed

Ahmed's children:

1. Abdosh

2. Fatuma

3. Khedra

4. Sefiya

5. Meymuna

6. Abdusemed

7. Abdulmanan

8. Amina

9. Ametulla

10. Kimya

11. Nejuma

12. Abduletif

13. Abdulhanan

14. Hafiza

15. Abdurehim

16. Alfuleyla

17. Tenber

## Abdosh

Abdosh's children:

1. Rewda

2. Kemya

- Saedi

- Orit

3. Maria

- Abdulwahid

4. Yonis

- Muna

- Hamdi

- Eliyas

- Diniya

- Ahmed

- Dedsam

- Reyan

- Siyam

5. Ilias

- Abdulmenan

  - Ayan

  - Muhammed

- Hanan

- Khulud

- Sumeya

- Abdulkerim

6. Zekeriya

- No children currently recorded

7. Ishaq

- Reyan

- Hassenet

- Ekram

8. Eled

- Kimiyet

- Welid

9. Erit

- Zekeriya

10. Assas

- Amir

- Testi

- Mahir

- Nihan

11. Teweleda

- Abdulhamid

- Abdurehim

- Fatuma

- Amar

12. Tekaba

- Yenber

- Reyan

- Eman

- Aya

13. Nibarot

- Abdurahman

14. Birna

- Ahmed

- Elham

- Santi

15. Sinet

- Sumeya

- Samti

## Additional descendants under Yonis

Yonis's child Eliyas:

- Ezdihar

- Khulud

- Mim

- Yaa

Yonis's child Diniya:

- Atiqa

- Abdullahi

- Aliya

- Aisha

## Khedra

Khedra's children:

1. Tofik

- Sami

- Nejwa

- Remzi

- Mohamed

2. Ahmed

- Abdulmenan

- Zein

3. Yusuf

- Semir

- Semiha

- Sitra

4. Hayat

- Fethi

- Elham

- Muaz

5. Amira

- Sumeya

- Fatma

- Meryem

6. Mufti

- Amar

- Hafsa

- Jafer

- Abdurrahman

7. Sada

- No children currently recorded

8. Atika

- No children currently recorded

9. Hassen

- Zakir

- Amir

- Yusra

10. Ayneb

- Yusuf

- Anwar

- Humeyda

- Mereyem

- Khalid

11. Ismail

- No children currently recorded

## Other Ahmed branches

Fatuma:

- Rania

- Hayat

- Abdulrahman

- Kidlang

- Ahmed

- Firdaws

- Khalid

- Sitra

Sefiya:

- Al-Amin

- Alawiya

- Maymuna

- Fadbon

- Abdulkarim

- Abdulwahab

- Mohammed

Meymuna:

- Zakir

- Mardi

- Samti

Abdusemed:

- Najah

- Azeb

- Adib

- Amir

- Tasti

- Hamdi

Abdulmanan:

- Jalud

- Fethi

Amina:

- Afendi

- Zeki

Ametulla:

- Nader

- Babker

- Asaad

- Suhair

- Siham

- Ajmal

- Ayman

Kimya:

- Muktar

Nejuma:

- Yafet

- Roco

Abduletif:

- Timaj

- Welid

- Titugn

Abdulhanan:

- No children currently recorded

Hafiza:

- Niya

- Mohammed

Abdurehim:

- No children currently recorded

Alfuleyla:

- Gizman

- Testi

- Eman

Tenber:

- Liyana

- Merwan

IMPORTANT SPELLING RULE:

Use "Yonis", not "Younes".

Use "Eled", not "Elad".

Use "Ayneb", not "Anab".

Use "Samti", not "Samdi".

Use "Tofik" for Khedra's first child.

Do not automatically change names based on your own assumptions.

---

# 15. DESIGN DIRECTION

The design should feel:

- Elegant

- Family-oriented

- Warm

- Modern

- Calm

- Professional

Avoid making it look like a generic corporate dashboard.

Use:

- Clear typography

- Large readable family names

- Subtle cards

- Generous spacing

- Soft visual hierarchy

- Responsive design

- Mobile-friendly layout

The tree itself should be visually dominant.

Use subtle visual distinctions between generations and branches, but don't overdecorate it.

---

# 16. RESPONSIVE DESIGN

The application must work on:

- Desktop

- Laptop

- Tablet

- Mobile

On mobile, the tree should support:

- Touch pan

- Pinch zoom

- Easy branch expansion

- Person profile drawer/page

Do not simply shrink the desktop tree until it becomes microscopic.

---

# 17. IMPORTANT PRODUCT RULES

1. Do not invent data.

2. Do not hardcode the tree into frontend components.

3. Use PostgreSQL as the source of truth.

4. Relationships must be stored separately from people.

5. Make the system scalable to thousands of people.

6. Keep V1 focused.

7. Do not build social features.

8. Do not build unnecessary AI features.

9. Do not over-engineer.

10. Prioritize a working end-to-end system over visual gimmicks.

---

# 18. DEVELOPMENT APPROACH

Build this incrementally.

First:

1. Set up project structure.

2. Set up PostgreSQL + Prisma.

3. Create database schema.

4. Seed the current family data.

5. Create API endpoints.

6. Build the People page.

7. Build Search.

8. Build Person Profile.

9. Build Interactive Family Tree.

10. Build Admin CRUD.

11. Add responsive design.

12. Test the complete flow.

Do not jump directly into visual polish before the data model and relationships work correctly.

---

# 19. API STRUCTURE

Create clean REST endpoints such as:

GET /api/people

GET /api/people/:id

GET /api/people/:id/family

GET /api/people/search?q=

GET /api/tree/:rootId

POST /api/people

PUT /api/people/:id

DELETE /api/people/:id

POST /api/relationships

DELETE /api/relationships/:id

Use proper validation and error handling.

---

# 20. FINAL V1 SUCCESS TEST

V1 is successful if I can:

1. Search for "Hamdi".

2. Find Hamdi immediately.

3. Open Hamdi's profile.

4. See Hamdi's family relationships.

5. Navigate upward to Yonis.

6. Navigate sideways to another branch.

7. Open Khedra.

8. Expand Khedra → Tofik → Sami.

9. Add a new person through Admin.

10. Refresh the page and still see the new person because the data is stored in PostgreSQL.

Build the product around this workflow.

Start by planning the architecture and database schema, then implement the application step by step.

Do not add features outside this V1 scope unless they are necessary for the core functionality.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d7436d48-599e-4f77-b07f-6c59504ce2f6).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
