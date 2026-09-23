

**1\. Create login button on the client directiry page , vedor page is not as when we add a new cleint or vendor it should create with those demo password it hsoudl be update lofin creds anad update cleitn details or vendors 

**2\. The edit data for the communication matrix  in staed o the data they need pop up for edit no the form , the form only to add anything extra , and they shoud lbe able to export the commuication matrix they should be able to export the communication matrix in the exact matrix format with logos uploaded and sharnam branding as well.once all teh datd is fille din teh crms and the comms module for ht ath project they should be able to export execle and pdf in sharnam formats exactly with the clours they have shared with execla dn pdf both.

**3\. in the porejct set up itself they shoudl be able to uplaod client and venodr loggos accridn to selected vendors and clients 

**4\. The pmc proposal that is made has lot of things that can be edited , and we need a form fo rthe and the log and folow of propersoal creation pages are not preoprly linked please the flow properly , add new office address at appropiate places New office address : 

1018 , Samanvay Silver , BS Royal Orchid Hotel near Mujmahuda Circle, Akota, Vadodara, Gujarat, 390020

**5\. Bid managemnt is simplify is that , the pmc uploads a boq for the porejct and opens for the vendors  wihtout the rates and then the vendors gets notified and uploads the rates. it should work like this that the they upoalod and it saved in sharepoirnt adn the vendor and open thorught vendor or download and upload again and depending on the rates by vendors they generate the r2 statement if 2 or more vendrs are uploading 

**6\. The Hrms flow is bit messed up we need same tool like structure they shodu be able to selct candodate and generate all teh documents  and they new a preview all teh letters with thenames and varibales the put in beofre we publish to share point or download and also maketh flow for onbooarding. Dahboard tool remove not useful 

**7\. The portal doesnot log out need to fix that issues make sure it works when browser closed it should log out and proper logic for token swapping.

**8\. In crms we need  the first shudl be add client , tehen once added activate portal access form the crms only ,cosnutlant litst shodu be maintied as it is same flow add and open protal for them , consultant typs also reqruied.

**9\. muliple contacts can be there for each client so we shuo dbe siteclient contacs for that client so basically client represntatives can be many.

**10\. Sheet Maker (Notion / Sheets-like), SPDC org roles, CRM vs HRMS split**

- Custom Sheet Maker: grid, columns, formulas (SUM, IF, etc.), download **.xlsx** + **.csv** (PDF / Google Sheets parity — later).
- CRM Directory: **clients, consultants, vendors only** — not SPDC staff.
- HRMS → **Users**: SPDC logins, departments, **company roles** (Director, HR, Coordinator, Billing / Planning / PM / Senior / Junior / Safety / MEPF engineers), CTC.
- HRMS → **Documents**: appointment / engagement letters (preview → SharePoint or download).
- **Login role** (portal access) ≠ **company role** (letters & HR profile). Site team: login **SPDC site** + project assignment = all project modules.

**11\. Vouchers, attendance record, holidays**

- **Done in portal:** Expense vouchers with **bill/receipt upload** (PDF/photo) per submission; **attendance calendar** + **Download Excel** (Attendance + Leave tabs); **holiday CSV upload** on HRMS → Masters.
- **HR:** Assign leave balances per employee after CL/PL/SL/Emergency/Short types auto-seed on first open.

**12\. Letters, leave, site HR cleanup**

- **Letter templates:** Official files `01–11_SPDC_*.docx` + usage guide → `apps/api/formats/hrms/` via `npm run hrms:import-root-formats` (synced to repo). **Generate** = filled **.docx** + branded HTML (print PDF) + vault; **Preview** = HTML draft (use Generate for pixel-perfect Word).
- **Leave:** HRMS → Leave — apply CL, PL, Sick, Emergency, Short (types seeded). Set entitlements in **Users** / leave balances.
- **PL default 12** days per employee on HR user create (+ CL 12, SL 6, EL 3, SHL 24). Shown as *remaining / entitled* on Leave. HR edits balances, approves, **converts** leave type, cancels approved leave (restores balance).
- **Site team:** `/attendance` punch + calendar; vouchers with bills; trim extra HR clutter — ongoing UX pass.
- **Next:** Auto PDF engine (not browser print); per-employee monthly attendance Excel mail; letter preview from live .docx render.
