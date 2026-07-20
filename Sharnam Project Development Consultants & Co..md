# NDA

**NON-DISCLOSURE AGREEMENT**

This Non-Disclosure Agreement ("Agreement") is executed on this **\[Date\]** day of **\[Month, Year\]**, at **Ahmedabad, Gujarat**, by and between:

**Sharnam Project Development Consultants & Co.**, having its principal place of business at \[Insert Address\], hereinafter referred to as the **"Disclosing Party"**;

AND

**QRYX Tech Private Limited**, a company incorporated under the Companies Act, 2013, having its registered office at \[Insert Address\], hereinafter referred to as the **"Receiving Party"**.

*(The Disclosing Party and Receiving Party are collectively referred to as "Parties" and individually as "Party".)*

**1\. PURPOSE** The Receiving Party has been engaged by the Disclosing Party to provide software development, IT consulting, or related services (the "Purpose"). During this engagement, the Receiving Party will have access to sensitive internal and client-specific data belonging to the Disclosing Party.

**2\. DEFINITION OF CONFIDENTIAL INFORMATION** "Confidential Information" refers to any and all non-public, internal, private, or proprietary information of the Disclosing Party. This explicitly includes, but is not limited to: a) Names, contact details, and identities of the Disclosing Party’s clients; b) Client project details, contracts, financial data, drawings, and operational metrics; c) Any data belonging to the Disclosing Party’s clients that is shared with or accessed by the Receiving Party.

**3\. OBLIGATIONS OF THE RECEIVING PARTY** The Receiving Party expressly agrees to: a) Hold all Confidential Information in strict confidence and use it solely for the Purpose stated above; b) Not disclose, publish, leak, sell, or transfer any Confidential Information or client data to any third party without prior written consent from the Disclosing Party; c) Restrict access to the Confidential Information strictly to its employees, directors, or contractors who have a "need to know" and are bound by identical confidentiality obligations; d) Ensure robust IT and physical security measures are in place to prevent unauthorized access or data breaches.

**4\. EXCLUSIONS** Confidential Information does not include information that: a) Is or becomes publicly known through no fault of the Receiving Party; b) Was rightfully known by the Receiving Party prior to disclosure; c) Is legally required to be disclosed by a court or government authority (provided the Receiving Party gives prompt written notice to the Disclosing Party).

**5\. RETURN OR DESTRUCTION OF DATA** Upon termination of the engagement or written request by the Disclosing Party, the Receiving Party shall immediately return or securely destroy all Confidential Information (including digital client data files) and certify such destruction in writing.

**6\. REMEDIES** The Receiving Party acknowledges that unauthorized disclosure of client data may cause irreparable harm to the Disclosing Party. In the event of a breach, the Disclosing Party shall be entitled to seek immediate injunctive relief, in addition to claiming damages and pursuing criminal remedies under applicable Indian cyber laws (e.g., Information Technology Act, 2000).

**7\. TERM AND SURVIVAL** This Agreement comes into effect on the date of signing. The obligation to protect the Confidential Information, particularly internal client data, shall survive the termination of the commercial relationship between the Parties for a period of **\[Three/Five\] (X)** years.

**8\. GOVERNING LAW AND JURISDICTION** This Agreement shall be governed by the laws of India. Any disputes arising out of this Agreement shall be subject to the exclusive jurisdiction of the competent courts at **Ahmedabad, Gujarat**.

**IN WITNESS WHEREOF**, the Parties have executed this Agreement on the date first written above.

**For Disclosing Party:**  
 **Sharnam Project Development Consultants & Co.**

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
 Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
 Title: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**For Receiving Party:**  
 **QRYX Tech Private Limited**

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_  
 Name: Rimal Kotadia  
 Title: Founder / Director

# Drawing & Checklist RFI Module

**Drawing & Checklist RFI Module**

## **1\. Drawing Management Table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| drawing\_id | UUID/Auto-increment | Yes | Unique identifier for each drawing record |
| project\_id | Foreign Key | Yes | Links drawing to a specific project |
| drawing\_number | String | Yes | Official drawing/sheet number (e.g., A-101) |
| drawing\_title | String | Yes | Descriptive title (e.g., "Ground Floor Plan") |
| discipline | Enum | Yes | Architecture, Structural, MEP, Civil, etc. |
| revision\_number | String | Yes | Current revision (e.g., Rev C) |
| revision\_date | Date | Yes | Date of current revision |
| revision\_status | Enum | Yes | Draft, For Review, Approved, Superseded |
| file\_url | String (link) | Yes | Storage link to the actual drawing file |
| uploaded\_by | Foreign Key (User) | Yes | Who uploaded this revision |
| upload\_timestamp | Timestamp | Yes | When it was uploaded |
| previous\_revision\_id | Foreign Key (self) | No | Links to prior revision for version comparison |
| spec\_section\_link | String | No | Ties drawing to a spec section, if applicable |
| markup\_data | JSON | No | Stores annotation/markup coordinates for pinning \[[smartapp](https://www.smartapp.com/field)\] |
| is\_superseded | Boolean | Yes | Flags if a newer revision exists |
| drawing\_log\_entry | Auto-generated | Yes | Time-stamped log of uploads/revisions for audit trail \[[smartapp](https://www.smartapp.com/field)\] |

## **2\. Checklist Module Table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| checklist\_id | UUID/Auto-increment | Yes | Unique identifier |
| project\_id | Foreign Key | Yes | Links to project |
| checklist\_name | String | Yes | e.g., "Pre-Pour Checklist – Block B" |
| checklist\_type | Enum | Yes | Quality, Safety, BOQ Verification, Handover |
| linked\_drawing\_id | Foreign Key | No | Optional link to the relevant drawing |
| checklist\_item\_id | UUID | Yes | Unique ID per individual checklist line item |
| item\_description | String | Yes | e.g., "Verify beam size at Grid C4" |
| status | Enum | Yes | Pending, Passed, Failed, Unresolved |
| reviewed\_by | Foreign Key (User) | No | Who reviewed the item |
| review\_date | Date | No | When it was reviewed |
| auto\_generate\_rfi | Boolean | Yes | If true, marking "Unresolved" auto-creates linked RFI |
| linked\_rfi\_id | Foreign Key | No | Populated once an RFI is auto-generated from this item |

## **3\. RFI Module Table (Core)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| rfi\_id | UUID/Auto-increment | Yes | Unique RFI number, auto-assigned |
| project\_id | Foreign Key | Yes | Links to project |
| subject | String | Yes | Short title of the RFI \[[construction.autodesk](https://construction.autodesk.com/resources/checklists/rfi-template/)\] |
| question | Text | Yes | Full detailed question \[[construction.autodesk](https://construction.autodesk.com/resources/checklists/rfi-template/)\] |
| status | Enum | Yes | Draft, Open, Answered, Closed |
| ball\_in\_court | Enum | Yes | Creator, Assignee — tracks current ownership |
| assigned\_to | Foreign Key (User) | Yes | Person/role responsible for answering |
| created\_by | Foreign Key (User) | Yes | Who raised the RFI |
| due\_date | Date | Yes (auto-set if blank) | Deadline for response |
| date\_created | Timestamp | Yes | Auto-logged creation date |
| date\_closed | Timestamp | No | Auto-logged on closure |
| linked\_drawing\_id | Foreign Key | No | Drawing referenced by this RFI |
| drawing\_pin\_coordinates | JSON | No | X/Y location on drawing where issue was flagged \[[smartapp](https://www.smartapp.com/field)\] |
| linked\_checklist\_item\_id | Foreign Key | No | If auto-generated from a checklist |
| spec\_section\_link | String | No | Ties RFI to a spec section \[[construction.autodesk](https://construction.autodesk.com/resources/checklists/rfi-template/)\] |
| responsible\_contractor | Foreign Key (Vendor) | No | For reporting only, not notifications |
| question\_received\_from | String | No | Logs origin for contractor-wise reports |
| distribution\_list | Array of User IDs | No | CC-like list; can comment, not primary assignee |
| schedule\_impact | Enum | No | None, Low, Medium, High |
| cost\_impact | Enum | No | None, Low, Medium, High |
| is\_private | Boolean | Yes | Restricts visibility to admin \+ assignee \+ distribution list |
| attachments | Array (file URLs) | No | Photos, files, or pulled drawings |

## **4\. RFI Response Table (Linked)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| response\_id | UUID | Yes | Unique response identifier |
| rfi\_id | Foreign Key | Yes | Links back to the parent RFI |
| responded\_by | Foreign Key (User) | Yes | Who submitted the response |
| response\_channel | Enum | Yes | Web, Mobile App, Email Reply — logs origin channel |
| response\_text | Text | Yes | The actual answer |
| response\_timestamp | Timestamp | Yes | When submitted |
| is\_official\_response | Boolean | Yes | Marked true once admin approves it |
| approved\_by | Foreign Key (User) | No | Admin who marked it official |
| reassigned\_to | Foreign Key (User) | No | If admin decides original answer is insufficient |

## **5\. Notification/Escalation Table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| notification\_id | UUID | Yes | Unique ID |
| rfi\_id | Foreign Key | Yes | Links to the RFI triggering this notification |
| trigger\_type | Enum | Yes | Due Date Reminder, Overdue Escalation, Status Change |
| sent\_to | Foreign Key (User) | Yes | Recipient |
| sent\_timestamp | Timestamp | Yes | When notification was sent |
| channel | Enum | Yes | Email, Push, SMS, WhatsApp |

## **Key relationships to build in your data model**

* One **Drawing** can have many **RFIs** linked to it (one-to-many), and each RFI can optionally reference a specific pin location on the drawing.\[[smartapp](https://www.smartapp.com/field)\]  
* One **Checklist Item** can auto-generate exactly one **RFI** if marked unresolved, creating a direct one-to-one link between the two modules — this was your original ask to tie checklists and RFIs together.  
* **Revision control** on drawings should always retain the `previous_revision_id` chain, so any RFI referencing an older revision can still be traced even after a newer version is uploaded, avoiding the "which version was this RFI raised against" problem common in disputes.\[[sitesetu](https://sitesetu.app/product)\]  
* The `ball_in_court` field is the single most important status driver for your dashboard — it directly determines whose action item is pending, and should feed into any "open RFIs by owner" report Sharnam-type PMCs would want.

This schema gives your dev team enough structure to start building both the Drawing repository and the Checklist-to-RFI pipeline as one connected system, matching the workflow logic you saw in the Procore demo, but adapted with drawing-pin and checklist-auto-generation capabilities that go a step further.

This one's short and gold — it's exactly what your Drawing module needs to close the loop on revision tracking with **visual comparison overlays**.

## **Procore Drawing Comparisons — Key Feature**

* **Single drawing overlay**: Inside the Drawings tool, you can overlay a drawing's previous revision on top of its current version. Procore automatically highlights **additions in blue** and **subtractions in red**, so changes jump out visually instead of requiring manual side-by-side review.\[[play.google](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en_IN)\]  
* **Historical version comparison**: This isn't limited to just the immediately prior revision — sliders let you compare against any historical version of that drawing, not only the last one.\[[play.google](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en_IN)\]  
* **Important caveat**: Moving the comparison sliders actually changes which historical version is treated as "current" for that view, so users must remember to **reset the slider** after finishing a comparison to avoid confusion later.\[[play.google](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en_IN)\]  
* **Bulk overlay via Drawing Sets**: The more powerful, lesser-known feature — instead of comparing one drawing at a time, you can overlay an entire **drawing set** against another set (e.g., "Tender Set" vs "Issued for Construction Set").\[[play.google](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en_IN)\]  
* **Automated PDF delivery**: For bulk set comparisons, Procore doesn't render this live — it processes the overlay in the background and **emails you a PDF** with the full set-wide comparison, using the same blue/red convention, once ready for download.\[[play.google](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en_IN)\]  
* **Use case emphasis**: This is specifically called out as "super useful" for tracking large-scale changes across a project phase transition (e.g., tender to IFC) or major design change events, rather than just single-sheet revisions.\[[play.google](https://play.google.com/store/apps/details?id=com.google.android.youtube&hl=en_IN)\]

## **Data model additions to your Drawing module**

Extend your earlier `Drawing` table logic with a dedicated comparison feature:

## **DrawingComparison table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| comparison\_id | UUID | Yes | Unique comparison record |
| project\_id | Foreign Key | Yes | Project |
| comparison\_type | Enum | Yes | Single Drawing, Drawing Set |
| base\_drawing\_id | Foreign Key | Yes | The "older" revision being compared from |
| base\_revision\_id | Foreign Key | Yes | Specific historical revision selected |
| target\_drawing\_id | Foreign Key | Yes | The "current"/newer revision being compared to |
| target\_revision\_id | Foreign Key | Yes | Specific revision selected as current |
| requested\_by | Foreign Key (User) | Yes | Who triggered the comparison |
| requested\_timestamp | Timestamp | Yes | When comparison was requested |
| status | Enum | Yes | Processing, Completed, Failed |
| output\_file\_url | String | No | Generated PDF/overlay result (for bulk set comparisons) |
| addition\_color\_code | String | Yes | Default "Blue" — configurable if needed |
| subtraction\_color\_code | String | Yes | Default "Red" — configurable if needed |

## **DrawingSetComparison table (for bulk overlays)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| set\_comparison\_id | UUID | Yes | Unique bulk comparison record |
| comparison\_id | Foreign Key | Yes | Parent DrawingComparison record |
| base\_drawing\_set\_id | Foreign Key | Yes | e.g., "Tender Set" |
| target\_drawing\_set\_id | Foreign Key | Yes | e.g., "Issued for Construction Set" |
| total\_sheets\_compared | Integer | Yes | Count of sheets processed |
| email\_sent\_to | Foreign Key (User) | Yes | Recipient of the result PDF |
| email\_sent\_timestamp | Timestamp | No | When the notification/PDF link was sent |

## **DrawingComparisonSliderState table (session-level, optional)**

Since the video flags a real UX risk (sliders altering "current" version state), you may want to explicitly track this rather than silently mutate the drawing record:

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| session\_id | UUID | Yes | Unique viewing session |
| comparison\_id | Foreign Key | Yes | Parent comparison |
| user\_id | Foreign Key (User) | Yes | Who is viewing |
| slider\_position\_revision\_id | Foreign Key | Yes | Which historical revision the slider is currently set to |
| is\_reset | Boolean | Yes | Whether the slider was reset to default after viewing |
| session\_start | Timestamp | Yes | When viewing started |
| session\_end | Timestamp | No | When viewing ended |

## **How this connects to your existing modules**

* **DrawingComparison ↔ RFIs/Design Coordination**: A clean use case is letting an RFI or Coordination Issue reference a `comparison_id` directly — e.g., "RFI raised because Rev C moved this wall 300mm compared to Rev B, see attached comparison" — turning a visual diff into supporting evidence rather than a text description.  
* **DrawingComparison ↔ Change Events**: Since the video specifically calls out "tender to IFC" as the flagship use case, this ties directly into your Budget/Cashflow logic — a bulk set comparison result could be the trigger/evidence for opening a Change Event when a major revision affects scope.  
* **Avoiding the slider bug in your own build**: Rather than mutating the "current" drawing state when a user drags a comparison slider (as Procore apparently does, requiring manual reset), it's worth designing your version as **read-only/session-scoped** — the comparison view should never alter the actual `published` revision flag on the underlying Drawing record. This is a genuine improvement opportunity over Procore's implementation.

# Uploading Drawing Revisions – what it implies for…

## **Uploading Drawing Revisions – what it implies for your Drawing module**

## **Key behaviour from the video**

* Users upload an original drawing set (Revision 0).  
* Later, they upload a new PDF set and mark it as “Revision 1 / structural updates”.  
* Procore auto-detects that this is an existing set, creates a new revision set, and uses OCR to:  
  * Read sheet numbers and titles.  
  * Map pages in the new PDF to existing drawing records.  
* Users then:  
  * Review detected sheet numbers/names.  
  * Correct any OCR mistakes.  
  * Confirm all.  
  * Publish the new revision so the latest version is visible, while older revisions remain accessible.[smartapp](https://www.smartapp.com/field)

## **Features you should mirror**

* Bulk upload of a PDF set with:  
  * Revision label (e.g., “Rev 1 – Structural Updates”).  
  * Received date and drawing date.  
* Auto-detection/mapping:  
  * OCR or filename parsing to detect sheet numbers/titles.  
  * Prompt UI for “review & confirm” of auto-detected fields.  
* Versioning:  
  * Always show the latest revision in the main drawings list.  
  * Maintain history so older revisions are viewable.  
* Publishing:  
  * Uploaded revisions are in a review state until “publish” is clicked.  
  * Once published, site/PMC users see the new revision by default.

## **Data model additions (extend the Drawing table from before)**

Add these fields or ensure they’re well supported:

* `revision_set_id` (grouping uploads by batch, e.g., “Rev 1 set”).  
* `revision_label` (string: “Rev 1”, “Rev 1A”, etc.).  
* `source_pdf_id` (file link to the uploaded multi-page PDF).  
* `ocr_status` (Enum: Pending, Completed, Needs Review).  
* `ocr_raw_data` (JSON: raw detected titles/numbers per page).  
* `review_status` (Enum: Not Started, In Progress, Confirmed).  
* `published` (Boolean: whether this revision is visible as “current”).

This gives you a proper **revision engine** behind the Drawing & RFI module.

---

## **2\. Project Photos – what it implies for your Photos/Attachment module**

## **Key behaviour from the video**

* Each project has a Photos section with an **inbound email address**.  
* Site users can:  
  * Take photos on phone.  
  * Email them directly to that project address.  
* Procore automatically:  
  * Stores all incoming photos to an Unclassified folder.  
  * Lets users bulk-move them into named albums (e.g., “April Framing”).  
* Bulk actions let users:  
  * Set description (e.g., “Framing pics – north security office”).  
  * Set location/trade.  
  * Set album (folder).  
  * Set privacy (private vs visible to all project users).  
* In the album view, users can:  
  * Zoom, rotate, annotate, comment.  
  * Email a photo to any project stakeholder from inside Procore.[smartapp](https://www.smartapp.com/field)

## **Features you should mirror**

For your app (where photos are often tied to RFIs, checklists, and drawings):

* Project-level inbound email:  
  * Auto-generated address per project, for direct photo ingestion.  
* Unclassified bucket:  
  * All emailed/auto-uploaded photos land here by default.  
* Albums/folders:  
  * Users can create named albums (e.g., “April Framing”, “Site 1 – Steel Fixing”).  
  * Move photos between albums via bulk actions.  
* Photo metadata:  
  * Description, location, trade, date taken.  
  * Privacy (Admin-only vs all project users).  
* Integration:  
  * Any RFI, checklist item, or drawing pin can attach photos from the photos module.  
* Inline communication:  
  * Ability to comment on a photo.  
  * Option to email/share a photo to selected users directly.

## **Data model: ProjectPhotos table**

| Field Name | Data Type | Required | Description |
| :---- | :---- | :---- | :---- |
| photo\_id | UUID | Yes | Unique photo record |
| project\_id | Foreign Key | Yes | Which project it belongs to |
| file\_url | String | Yes | Storage link |
| source\_channel | Enum | Yes | Email, Mobile App, Web Upload |
| inbound\_email\_address | String (per project) | Yes | Address used to ingest photos |
| album\_id | Foreign Key | No | Link to album; null \= Unclassified |
| description | String | No | Short text describing the photo |
| location | String/Foreign Key | No | Site location or building level |
| trade | Enum/String | No | e.g., Civil, Electrical, Plumbing |
| is\_private | Boolean | Yes | Controls visibility |
| taken\_timestamp | Timestamp | No | When the photo was taken (EXIF or manually) |
| uploaded\_by | User FK | No | Who initiated upload (if not email) |

**Data model: PhotoAlbum table** 

| Field Name | Data Type | Required | Description |
| :---- | :---- | :---- | :---- |
| album\_id | UUID | Yes | Album identifier |
| project\_id | Foreign Key | Yes | Project |
| album\_name | String | Yes | e.g., “April Framing” |
| created\_by | User FK | Yes | Who created it |
| created\_timestamp | Timestamp | Yes | When it was created |

## **2\. Photos Tool — Mobile-Specific Additions**

This video adds mobile capture detail that should extend your existing ProjectPhotos table from earlier.

## **What the video shows**

* Two capture modes from the app's camera:  
  * **Quick Snap** — rapid-fire multiple photos in a row without stopping to annotate each one.[support.procore](https://support.procore.com/references/user-permissions-matrix-web)  
  * **Photo** — single capture, but allows adding text boxes, markups, and captions immediately.[support.procore](https://support.procore.com/references/user-permissions-matrix-web)  
* Photos are assigned to an **album** at the point of capture (e.g., "Construction Coordinator Visit 1").[support.procore](https://support.procore.com/references/user-permissions-matrix-web)  
* **In-app markup tools**: pens/annotations, zoom, and direct send via message/email from within the photo viewer.[support.procore](https://support.procore.com/references/user-permissions-matrix-web)  
* **Upload Queue**: a dedicated screen shows photos pending upload; critically, **the app must stay open** for uploads to process — it does not upload in the background, which matters a lot for poor-signal job sites.[support.procore](https://support.procore.com/references/user-permissions-matrix-web)  
* **Storage toggle**: an option to avoid double-storing photos on the phone's camera roll, since Procore auto-uploads and doesn't need a local backup copy.[support.procore](https://support.procore.com/references/user-permissions-matrix-web)

## **Data model additions to ProjectPhotos table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| capture\_mode | Enum | No | Quick Snap, Single Photo |
| markup\_data | JSON | No | Pen annotations, text boxes added at capture or later |
| upload\_status | Enum | Yes | Queued, Uploading, Uploaded, Failed |
| upload\_queue\_timestamp | Timestamp | No | When it entered the queue |
| save\_to\_device | Boolean | Yes | Whether a local copy is also kept on the device |

## **Data model: PhotoUploadQueue table**

| Field Name | Data Type | Required | Description |
| :---: | :---: | :---: | :---: |

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| queue\_id | UUID | Yes | Unique queue record |
| photo\_id | Foreign Key | Yes | Linked photo pending upload |
| user\_id | Foreign Key (User) | Yes | Who captured it |
| device\_id | String | No | Device identifier for debugging sync issues |
| status | Enum | Yes | Pending, In Progress, Completed, Failed |
| retry\_count | Integer | No | Number of retry attempts if upload failed |
| last\_attempt\_timestamp | Timestamp | No | Most recent upload attempt |

# Submittals and Personal Work Diary (Daily Log)

**Submittals and Personal Work Diary (Daily Log)** 

## **1\. Submittals Module**

## **Key behaviour from the video**

* Users create a submittal with title, type, and specification section, then assign it to a responsible subcontractor or team member.\[[youtube](https://www.youtube.com/watch?v=GVgaknrLR_A)\]  
* Submittals attach cut sheets, product data, drawings, and material samples — either uploaded directly or pulled from the Documents tool.\[[youtube](https://www.youtube.com/watch?v=GVgaknrLR_A)\]  
* Custom review/approval workflows are set with due dates and automatic email notifications to keep things on schedule.\[[youtube](https://www.youtube.com/watch?v=GVgaknrLR_A)\]  
* Each submittal displays a live status (Draft, Submitted, Reviewed, Approved) and shows its current location in the review chain, with filtering by status, assignee, or due date.\[[youtube](https://www.youtube.com/watch?v=GVgaknrLR_A)\]  
* Detailed logs can be exported showing the full history of submissions, comments, and approvals, and shared with owners or design teams.\[[youtube](https://www.youtube.com/watch?v=GVgaknrLR_A)\]  
* Workflow templates allow adding multiple approval steps with defined roles (Approver/Submitter), required or optional response settings, and days-to-respond per step.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/submittals-project/tutorials/manage-submittal-workflow-templates)\]  
* Ball-in-court tracking, forwarding for review, and distribution to additional parties are all supported as core actions.\[[en-gb.support.procore](https://en-gb.support.procore.com/products/online/user-guide/project-level/submittals/tutorials/create-a-submittal)\]

## **Data model: Submittals table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| submittal\_id | UUID/Auto-increment | Yes | Unique identifier, auto-numbered |
| project\_id | Foreign Key | Yes | Links to project |
| title | String | Yes | Short title of the submittal |
| submittal\_type | Enum | Yes | Product Data, Shop Drawing, Material Sample, etc. |
| spec\_section\_link | String | Yes | Ties submittal to a specification section |
| status | Enum | Yes | Draft, Submitted, Reviewed, Approved, Closed |
| ball\_in\_court | Enum | Yes | Submitter, Approver — current ownership |
| assigned\_submitter | Foreign Key (User/Vendor) | Yes | Responsible subcontractor/team member |
| created\_by | Foreign Key (User) | Yes | Who created the submittal |
| due\_date | Date | Yes | Deadline for current step |
| workflow\_template\_id | Foreign Key | No | Applied workflow template, if any |
| current\_step | Integer | Yes | Which step in the multi-step workflow it's on |
| attachments | Array (file URLs) | No | Cut sheets, drawings, samples, product data |
| distribution\_list | Array of User IDs | No | Additional parties notified/CC'd |
| is\_private | Boolean | Yes | Restricts visibility |
| date\_created | Timestamp | Yes | Auto-logged |
| date\_closed | Timestamp | No | Auto-logged on closure |

## **Data model: SubmittalWorkflowStep table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| step\_id | UUID | Yes | Unique step identifier |
| submittal\_id | Foreign Key | Yes | Parent submittal |
| step\_order | Integer | Yes | Sequence number in the workflow |
| role | Enum | Yes | Approver, Submitter |
| assigned\_user | Foreign Key (User) | Yes | Person responsible for this step |
| is\_required | Boolean | Yes | Whether response is mandatory to proceed |
| days\_to\_respond | Integer | Yes | SLA for this step |
| response\_text | Text | No | Comments/decision entered |
| response\_status | Enum | No | Approved, Rejected, Revise & Resubmit |
| response\_timestamp | Timestamp | No | When this step was completed |

---

## **2\. Personal Work Diary / Daily Log Module**

## **Key behaviour from the videos**

* Each day gets its own log entry, and all activity from that specific date rolls into the same daily record.\[[youtube](https://www.youtube.com/watch?v=vz3gB-4pPJg)\]  
* Weather is either auto-picked up (via latitude/longitude) or manually entered if unusual conditions occurred (e.g., a storm).\[[youtube](https://www.youtube.com/watch?v=JIZjDYmnPAA)\]  
* Manpower entries record subcontractor company, number of workers, hours worked (defaults to 8 hours but editable), and free-text comments describing what was done and when.\[[youtube](https://www.youtube.com/watch?v=nHRPTcm4zuU)\]  
* Photos can be captured directly within the log entry via an in-app camera button and attached to that day's manpower or general notes.\[[youtube](https://www.youtube.com/watch?v=nHRPTcm4zuU)\]  
* Equipment usage is logged similarly to manpower — company, equipment type, and time period.\[[youtube](https://www.youtube.com/watch?v=vz3gB-4pPJg)\]  
* Critically, users must explicitly hit "Create" (or save) after each section (manpower, notes, equipment) — otherwise the entry is not saved, even though the log itself stays open for continued editing.\[[youtube](https://www.youtube.com/watch?v=vz3gB-4pPJg)\]  
* The log intentionally stays in an open/editable state ("do not complete and distribute") so multiple team members can keep adding entries throughout the day before it's finalized.\[[youtube](https://www.youtube.com/watch?v=vz3gB-4pPJg)\]  
* The full daily log structure typically includes: Weather, Manpower, Photos, Notes, and a final Log Completion step.\[[youtube](https://www.youtube.com/watch?v=JIZjDYmnPAA)\]

## **Data model: DailyLog table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| daily\_log\_id | UUID | Yes | Unique identifier per calendar day per project |
| project\_id | Foreign Key | Yes | Links to project |
| log\_date | Date | Yes | The specific day this log covers |
| weather\_condition | String/Enum | No | Auto-fetched via geolocation or manually entered |
| weather\_source | Enum | No | Auto (Lat/Long), Manual |
| status | Enum | Yes | Open, Completed & Distributed |
| created\_by | Foreign Key (User) | Yes | Who initiated the day's log |
| completed\_by | Foreign Key (User) | No | Who finalized/distributed it |
| completed\_timestamp | Timestamp | No | When it was marked complete |

## **Data model: DailyLogManpower table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| manpower\_id | UUID | Yes | Unique entry ID |
| daily\_log\_id | Foreign Key | Yes | Parent daily log |
| company\_id | Foreign Key (Vendor) | Yes | Subcontractor/company name |
| worker\_count | Integer | Yes | Number of workers |
| hours\_worked | Decimal | Yes | Defaults to 8, editable |
| comments | Text | No | Free-text description of work performed |
| attached\_photos | Array (Photo IDs) | No | Linked from Photos module |
| entry\_saved | Boolean | Yes | Tracks whether "Create" was actually clicked |

## **Data model: DailyLogEquipment table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| equipment\_log\_id | UUID | Yes | Unique entry ID |
| daily\_log\_id | Foreign Key | Yes | Parent daily log |
| company\_id | Foreign Key (Vendor) | Yes | Owning subcontractor/company |
| equipment\_type | String | Yes | e.g., Excavator, Crane |
| hours\_used | Decimal | No | Duration of use |
| comments | Text | No | Notes on usage |

## **Data model: DailyLogNotes table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| note\_id | UUID | Yes | Unique note ID |
| daily\_log\_id | Foreign Key | Yes | Parent daily log |
| note\_text | Text | Yes | Free-form observation |
| created\_by | Foreign Key (User) | Yes | Author |
| timestamp | Timestamp | Yes | When the note was added |

---

## **How this ties into your existing modules**

* **Submittals ↔ Drawings**: Submittals frequently attach shop drawings, so linking `submittal_id` to `linked_drawing_id` (from your Drawing table) lets you track approval status directly against a drawing revision.  
* **Submittals ↔ RFI**: If an approver rejects a submittal with a technical question, that should be able to spin off a linked RFI, similar to your checklist-to-RFI auto-generation logic.  
* **Daily Log ↔ Photos**: Photos captured in the daily log camera button should write directly into your ProjectPhotos table with `source_channel = Mobile App` and auto-tag the album to that day's date.  
* **Daily Log ↔ Inventory/BOQ**: Manpower and equipment hours logged daily are a natural feed into your cost-tracking/reconciliation module, since labor cost is often a missing piece in pure procurement-focused tools like yours.

This gives you two more fully-specified modules (Submittals \+ Daily Log) to hand to your dev team, consistent with the RFI, Drawing, and Photos schemas from earlier. If you want, I can now compile a **single master ER diagram description** tying all five modules (RFI, Drawings, Checklist, Photos, Submittals, Daily Log) together with their foreign key relationships in one document.

# Meetings/MoM and Communication Matrix

**Meetings/MoM** and **Communication Matrix**

## **1\. Meetings & Minutes of Meeting (MoM) Module**

## **Key behaviour from Procore's Meetings tool**

* Meetings can be created individually, as a **recurring series**, or generated from a **saved template** that pre-populates standard categories (e.g., Safety, Quality, Schedule).\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials)\]  
* Every meeting has two modes: **Agenda mode** (before the meeting, for planning topics) and **Minutes mode** (during/after, for recording what was actually discussed and decided) — and can be converted from one to the other.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials/add-meeting-minutes)\]  
* Meeting items are grouped under **categories**, and each item can be individually assigned a responsible person, due date, priority, cost code, and resolution status.\[[procore](https://www.procore.com/project-management/meetings)\]  
* Attendance is explicitly recorded per meeting, separate from the person who created it.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials)\]  
* Once minutes are finalized, they can be **distributed via email** to attendees, and the entire email thread (opens, replies) is automatically logged against that meeting for audit purposes.\[[procore](https://www.procore.com/project-management/meetings)\]  
* Attendees can **approve, reject, or comment** on minutes after distribution, creating an accountability trail.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials)\]  
* The single most important automation: **any unresolved item automatically carries over to the next meeting's agenda**, so nothing gets dropped between sessions.\[[procore](https://www.procore.com/project-management/meetings)\]  
* Follow-up meetings can be created directly from an existing meeting, preserving context and open items.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials)\]  
* Meetings can also spawn a **Change Event** directly if a discussion item reveals a cost/scope impact — linking meetings into your budget/change-order workflow.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials)\]  
* A full change history and "Meetings Recycle Bin" preserve deleted/edited meeting records for audit purposes.\[[v2.support.procore](https://v2.support.procore.com/product-manuals/meetings-project/tutorials)\]

## **Data model: Meetings table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| meeting\_id | UUID | Yes | Unique meeting identifier |
| project\_id | Foreign Key | Yes | Links to project |
| title | String | Yes | e.g., "Weekly Site Coordination Meeting" |
| meeting\_series\_id | Foreign Key (self) | No | Groups recurring meetings together |
| template\_id | Foreign Key | No | If created from a saved template |
| meeting\_date | Date | Yes | Scheduled date |
| meeting\_time | Time | Yes | Scheduled time |
| location | String | No | Physical or virtual location/link |
| status | Enum | Yes | Agenda, Minutes, Distributed, Closed |
| created\_by | Foreign Key (User) | Yes | Who scheduled the meeting |
| is\_follow\_up\_of | Foreign Key (self) | No | Links to the originating meeting if this is a follow-up |

## **Data model: MeetingCategory table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| category\_id | UUID | Yes | Unique identifier |
| meeting\_id | Foreign Key | Yes | Parent meeting |
| category\_name | String | Yes | e.g., "Safety", "Quality", "Schedule" |
| order\_index | Integer | Yes | Display order in agenda/minutes |

## **Data model: MeetingItem table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| item\_id | UUID | Yes | Unique meeting item identifier |
| category\_id | Foreign Key | Yes | Parent category |
| meeting\_id | Foreign Key | Yes | Parent meeting |
| item\_description | Text | Yes | Discussion topic/decision |
| assigned\_to | Foreign Key (User) | No | Responsible person |
| due\_date | Date | No | Resolution deadline |
| priority | Enum | No | Low, Medium, High |
| cost\_code | String | No | Ties item to a budget line |
| resolution\_status | Enum | Yes | Open, In Progress, Resolved, Carried Over |
| carried\_over\_from | Foreign Key (self) | No | Links to the original item if auto-carried from a prior meeting |
| linked\_change\_event\_id | Foreign Key | No | If this item spawned a Change Event |
| comments | Array (Comment objects) | No | Approve/reject/comment thread from attendees |

## **Data model: MeetingAttendance table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| attendance\_id | UUID | Yes | Unique record |
| meeting\_id | Foreign Key | Yes | Parent meeting |
| attendee\_id | Foreign Key (User) | Yes | Person who attended |
| attendance\_status | Enum | Yes | Present, Absent, Excused |
| role\_in\_meeting | String | No | e.g., "Chair", "Recorder", "Observer" |

## **Data model: MeetingDistribution table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| distribution\_id | UUID | Yes | Unique record |
| meeting\_id | Foreign Key | Yes | Parent meeting |
| sent\_to | Foreign Key (User) | Yes | Recipient |
| sent\_timestamp | Timestamp | Yes | When agenda/minutes were sent |
| response\_status | Enum | No | Approved, Rejected, Commented, No Response |
| response\_timestamp | Timestamp | No | When recipient responded |

---

## **2\. Communication Matrix Module**

Procore doesn't have a single "Communication Matrix" tool by that name — instead, this concept is typically built by combining its **Correspondence tool** with structured logging across RFIs, Submittals, and Meetings. For your app, a dedicated Communication Matrix should sit as a **reporting layer** across all your other modules, showing who needs to talk to whom, how, and how often.\[[support.procore](https://support.procore.com/products/online/user-guide/project-level/correspondence/release-notes)\]

## **Recommended structure for your Communication Matrix**

* Define **stakeholder roles** (Client, PMC, Contractor, Consultant, Vendor) and what type of communication each role should receive, and at what frequency.  
* Map **communication type → channel → frequency → responsible party**, so it becomes a governance tool, not just a log.

## **Data model: CommunicationMatrix table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| matrix\_id | UUID | Yes | Unique identifier |
| project\_id | Foreign Key | Yes | Links to project |
| communication\_type | Enum | Yes | Weekly Report, RFI Update, Site Meeting, Progress Photos, Invoice Status |
| from\_role | Enum | Yes | Contractor, PMC, Client, Consultant |
| to\_role | Enum | Yes | Contractor, PMC, Client, Consultant |
| channel | Enum | Yes | Email, WhatsApp, App Notification, Physical Meeting |
| frequency | Enum | Yes | Daily, Weekly, Bi-weekly, Monthly, Ad-hoc |
| responsible\_user | Foreign Key (User) | Yes | Who ensures this communication happens |
| escalation\_contact | Foreign Key (User) | No | Who to notify if this communication is missed |
| last\_sent\_timestamp | Timestamp | No | Tracks compliance with the defined frequency |
| status | Enum | Yes | Active, Paused, Discontinued |

## **Data model: CommunicationLog table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| log\_id | UUID | Yes | Unique log entry |
| matrix\_id | Foreign Key | Yes | Links to the matrix rule that generated this |
| project\_id | Foreign Key | Yes | Links to project |
| sent\_by | Foreign Key (User) | Yes | Who actually sent it |
| sent\_to | Foreign Key (User) | Yes | Who received it |
| channel\_used | Enum | Yes | Actual channel used |
| linked\_reference | Foreign Key (Polymorphic) | No | Links to the RFI, Meeting, Submittal, or Photo this communication relates to |
| timestamp | Timestamp | Yes | When it was sent |
| acknowledged | Boolean | No | Whether the recipient confirmed receipt |

---

## **How this connects to your existing modules**

* **Meetings → RFIs/Submittals**: A meeting item that surfaces an unresolved technical question should be able to auto-generate an RFI, following the same pattern as your Checklist → RFI logic.  
* **Meetings → Change Events**: Directly linking a meeting item to a cost/schedule impact mirrors Procore's own workflow and feeds into your Budget/Cashflow tracking sheets.  
* **Communication Matrix → Everything**: This module acts as the compliance layer sitting above RFIs, Submittals, Meetings, and Daily Logs — letting a PMC like Sharnam see, at a glance, whether all required communications (e.g., "Client must get weekly progress report") are actually happening on schedule, which is exactly the kind of oversight tool a PMC would value in your earlier validation meeting.

This gives you two more fully-specified modules to add to your growing schema (RFI, Drawings, Checklist, Photos, Submittals, Daily Log, Meetings, Communication Matrix). Would you like me to now compile the **single master ER diagram/document** tying all eight modules together with their cross-references, so your dev team has one unified reference?

# Design Coordination

 **Design Coordination** 

## **Procore Design Coordination – Key Workflow**

* **Purpose**: Brings VDC (Virtual Design & Construction) managers, BIM coordinators, designers, and specialty contractors onto one connected platform to manage clash detection and coordination issues, instead of siloed BIM tools disconnected from field project management.\[[youtube](https://www.youtube.com/watch?v=FxXRxZizF04)\]  
* **Interactive dashboard**: All coordination issues (clashes, conflicts between disciplines like MEP vs Structural) are managed centrally in a dashboard view, rather than buried inside BIM software exports.\[[youtube](https://www.youtube.com/watch?v=FxXRxZizF04)\]  
* **Connected to project management**: Coordination is not a separate silo — it's directly tied into the same platform as scheduling, RFIs, and drawings, so field and design teams see the same data.\[[youtube](https://www.youtube.com/watch?v=FxXRxZizF04)\]  
* **Issue lifecycle**: An issue starts as a **Coordination Issue** (e.g., a clash flagged during BIM model review) and can be **directly elevated into an RFI** with one action — carrying forward context like the 3D location, discipline, and description, so nothing gets re-typed or lost in translation.\[[youtube](https://www.youtube.com/watch?v=FxXRxZizF04)\]

This is a very clean, minimal pattern — the entire value proposition is "detect issue in the model → escalate to RFI without leaving the platform."

## **Data model: DesignCoordinationIssue table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| issue\_id | UUID | Yes | Unique coordination issue identifier |
| project\_id | Foreign Key | Yes | Links to project |
| title | String | Yes | Short description, e.g., "HVAC duct clash with structural beam" |
| discipline\_1 | Enum | Yes | First discipline involved (e.g., MEP) |
| discipline\_2 | Enum | Yes | Second discipline involved (e.g., Structural) |
| linked\_drawing\_id | Foreign Key | No | Drawing/model sheet where clash was identified |
| model\_location\_coordinates | JSON | No | 3D/BIM coordinates or 2D pin location of the clash |
| status | Enum | Yes | Open, Under Review, Elevated to RFI, Resolved, Closed |
| severity | Enum | No | Low, Medium, High, Critical |
| identified\_by | Foreign Key (User) | Yes | BIM coordinator/VDC manager who flagged it |
| assigned\_to | Foreign Key (User) | No | Designer/contractor responsible for resolving |
| date\_identified | Timestamp | Yes | When the clash was detected |
| date\_resolved | Timestamp | No | When marked resolved |
| linked\_rfi\_id | Foreign Key | No | Populated once elevated to an RFI |
| comments | Array (Comment objects) | No | Discussion thread on the issue |
| attachments | Array (file URLs) | No | Screenshots, model exports, markups |

## **Data model: CoordinationIssueHistory table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| history\_id | UUID | Yes | Unique record |
| issue\_id | Foreign Key | Yes | Parent coordination issue |
| action | Enum | Yes | Created, Status Changed, Elevated to RFI, Resolved, Reopened |
| performed\_by | Foreign Key (User) | Yes | Who performed the action |
| timestamp | Timestamp | Yes | When the action occurred |
| notes | Text | No | Optional context for the action |

## **How this connects to your existing modules**

* **DesignCoordinationIssue → RFI**: The "elevate to RFI" action should auto-populate your existing RFI table — carrying over `title`, `linked_drawing_id`, `model_location_coordinates` (mapped to your `drawing_pin_coordinates` field), and `attachments` — exactly mirroring how your Checklist → RFI auto-generation already works. This means Design Coordination becomes a third entry point into RFIs, alongside manual creation and checklist-triggered creation.  
* **DesignCoordinationIssue → Drawings**: Since clashes are typically found on specific drawing sheets or BIM model views, linking `linked_drawing_id` back to your Drawing Revision table ensures that if the drawing gets superseded, coordinators can see whether the issue was resolved in the newer revision.  
* **Severity/Discipline tagging**: This is a smaller but useful addition to your reporting — a PMC like Sharnam would likely want a dashboard view showing "open clashes by discipline" or "critical unresolved coordination issues" as a project health indicator, separate from routine RFIs.

You now have 9 fully-specified modules: RFI, Drawings, Checklist, Photos, Submittals, Daily Log, Meetings, Communication Matrix, and Design Coordination. 

# Quality Inspections and a Documents/Files library

 **Quality Inspections** and a **Documents/Files library**. 

---

## **1\. Quality Inspection Module (from “Procore quality inspection”)**

## **What the video shows**

* User opens the **Inspections tool**, picks a **Quality Inspection template** (e.g., “CET458”) and creates a new inspection from it.\[[ppl-ai-file-upload.s3.us-east-1.amazonaws](https://ppl-ai-file-upload.s3.us-east-1.amazonaws.com/web/direct-files/collection_ad0925b7-fc2b-4a5d-a764-bb279164a3cb/d4b04f5f-c3b0-4114-8fdf-d37386409851/SYSTEM_CAPABILITIES.md.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYEUK3HBUMZ%2F20260712%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260712T190357Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIAfo6nt9x3u6VM2T8ZLAXzwuVVz7DRz7XUmR3l%2FHNCEEAiEAkyO0blXrj6YD4%2BP%2Fs6NLDjda%2BBQWVi1JwNWqSpnbA0oq9AQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDPdfoTI%2BHBkFGQUq8yrIBMSn%2FqNE9A11x68aegF47W%2Buute0J4aezPrGF%2BPhRen9V8xwxavnE%2BbjaC4vj37Oro0ih8XDcSGhJnUCanzdbLcMrG8yvoWaDc5OJZ7BeodSElj0nBI9fp%2F7YOEruVnt1Kpbh98xL2QZZVA1NvNgXfX1CTUTO5uFQjHwFhYRSsqSFyGSxn8lWeVh1LBLILYBP9zxwHnFmBMpA0619x%2FtIozKAE9ycF6Yyc0f2opEOeIMjYMiUpCJvWrp3vF1unQ0bYJGrMPq3opSPkdY0dOZjhI3PSx4TLTpV7CwYEm6a6WhPbzTNIb0qufeyScDN5gONtpDAOtlvQXNqxSpX0Byja7Y43roqGbrvqsolDTIXZd8JIsrb6SDdDAsVNEc%2FGYBp%2Byn43qiUCL2eu603iRp3pw4SM3vmVURS4TTFhFCcXHCAdTxB9ylmwbbQHhiK3YvbEm9kJt%2FH4KCH0K7U%2BBPXRJtefuUugsf4aAj2y9%2FgGFsUOWvCoan3sPCf6qFyJwdblXn0yWFl2yrusM1jQi6pjJwIf8%2FAR4hibpgpKeg1EvopuYRWsWlGyc3wWbPG7g%2BmZMdCTbcvjTatYp0T%2FZWQow3zrlwrgV%2Fao%2FYfce8mCS552hQ3jxqMuiPrITEkbMtMmTZ4RXx8xc7mEdfmUjSzGY9F3%2F37neq%2F0nBb7lGnYKZtPhSN1fjC1QtcmciVGeQ%2F8rwtmMxL1JVDTMIrLQRADC573PSgQ1AHCMMELyC5U4AXkCryNK9g57xPtn4HUWjeFNgcJXQXhvPMKe5z9IGOpgBu5YZQwH4oc2X1pQhzu%2FGlqXHCE149mPDP2qmIW4xboDaYTDIlZuGRp99LpIFCSprG1eHs5vg0C30%2BeQxdUIXYJQ2rnie7WQBIF3SIZgR530mYOsRg8DOivUB9miPNhiJb%2FteVndpNlnAXSHH8Pz9cgRbe5CgX%2FtsCwLy0msmVajUKMHKKIPZ9AqxBVfEsucgbYuBAtPyXQc%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=ca45ebeb4213e980e652fae701408964bbbe8ad84cf50ca97618b5269e97dc5b)\]  
* They set:  
  * Location (e.g., “Horunda Wildlife Refuge”).  
  * Assignees (e.g., add David, both were on site).  
  * Date performed (last Friday).  
  * Due date (e.g., 18th Sept).  
  * Contractor (usually their own company in the example).  
* Hit **Create**, the inspection is now “Open”.  
* Then they go through checklist-like items:  
  * Work item: “Installed piers all at same elevation, checked with rotary laser.”  
  * Response: Yes/No/Not applicable, plus optional comment.  
  * They mention adding photos is possible per item (site evidence).  
* For repetitive items, they mark **Not applicable** to skip irrelevant checks.  
* At the bottom, the UI shows **items inspected X out of Y done**, encouraging completion.  
* Once finished, they **email the inspection report** to a supervisor (Amber) and CC themselves, with all responses and comments included.\[[ppl-ai-file-upload.s3.us-east-1.amazonaws](https://ppl-ai-file-upload.s3.us-east-1.amazonaws.com/web/direct-files/collection_ad0925b7-fc2b-4a5d-a764-bb279164a3cb/d4b04f5f-c3b0-4114-8fdf-d37386409851/SYSTEM_CAPABILITIES.md.pdf?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYEUK3HBUMZ%2F20260712%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260712T190357Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIAfo6nt9x3u6VM2T8ZLAXzwuVVz7DRz7XUmR3l%2FHNCEEAiEAkyO0blXrj6YD4%2BP%2Fs6NLDjda%2BBQWVi1JwNWqSpnbA0oq9AQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDPdfoTI%2BHBkFGQUq8yrIBMSn%2FqNE9A11x68aegF47W%2Buute0J4aezPrGF%2BPhRen9V8xwxavnE%2BbjaC4vj37Oro0ih8XDcSGhJnUCanzdbLcMrG8yvoWaDc5OJZ7BeodSElj0nBI9fp%2F7YOEruVnt1Kpbh98xL2QZZVA1NvNgXfX1CTUTO5uFQjHwFhYRSsqSFyGSxn8lWeVh1LBLILYBP9zxwHnFmBMpA0619x%2FtIozKAE9ycF6Yyc0f2opEOeIMjYMiUpCJvWrp3vF1unQ0bYJGrMPq3opSPkdY0dOZjhI3PSx4TLTpV7CwYEm6a6WhPbzTNIb0qufeyScDN5gONtpDAOtlvQXNqxSpX0Byja7Y43roqGbrvqsolDTIXZd8JIsrb6SDdDAsVNEc%2FGYBp%2Byn43qiUCL2eu603iRp3pw4SM3vmVURS4TTFhFCcXHCAdTxB9ylmwbbQHhiK3YvbEm9kJt%2FH4KCH0K7U%2BBPXRJtefuUugsf4aAj2y9%2FgGFsUOWvCoan3sPCf6qFyJwdblXn0yWFl2yrusM1jQi6pjJwIf8%2FAR4hibpgpKeg1EvopuYRWsWlGyc3wWbPG7g%2BmZMdCTbcvjTatYp0T%2FZWQow3zrlwrgV%2Fao%2FYfce8mCS552hQ3jxqMuiPrITEkbMtMmTZ4RXx8xc7mEdfmUjSzGY9F3%2F37neq%2F0nBb7lGnYKZtPhSN1fjC1QtcmciVGeQ%2F8rwtmMxL1JVDTMIrLQRADC573PSgQ1AHCMMELyC5U4AXkCryNK9g57xPtn4HUWjeFNgcJXQXhvPMKe5z9IGOpgBu5YZQwH4oc2X1pQhzu%2FGlqXHCE149mPDP2qmIW4xboDaYTDIlZuGRp99LpIFCSprG1eHs5vg0C30%2BeQxdUIXYJQ2rnie7WQBIF3SIZgR530mYOsRg8DOivUB9miPNhiJb%2FteVndpNlnAXSHH8Pz9cgRbe5CgX%2FtsCwLy0msmVajUKMHKKIPZ9AqxBVfEsucgbYuBAtPyXQc%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=ca45ebeb4213e980e652fae701408964bbbe8ad84cf50ca97618b5269e97dc5b)\]

## **Data model: QualityInspection table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| inspection\_id | UUID | Yes | Unique inspection record |
| project\_id | Foreign Key | Yes | Links to project |
| template\_id | Foreign Key | Yes | Which inspection template was used |
| title | String | Yes | e.g., “Quality Inspection – Piers CET458” |
| location | String | Yes | Site/location of the inspection |
| status | Enum | Yes | Open, In Progress, Completed, Distributed |
| contractor\_id | Foreign Key (Vendor/Company) | Yes | Who performed the work being inspected |
| performed\_date | Date | Yes | Date inspection took place |
| due\_date | Date | No | Deadline to complete/approve inspection |
| assignees | Array (User IDs) | No | People assigned to the inspection |
| created\_by | Foreign Key (User) | Yes | Who created the inspection |
| created\_timestamp | Timestamp | Yes | When it was created |

## **Data model: InspectionTemplate table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| template\_id | UUID | Yes | Template identifier |
| project\_id | Foreign Key | Yes | Project or global template |
| template\_name | String | Yes | e.g., “Pier Installation QA Template” |
| description | String | No | What this template is for |
| items | Array (TemplateItem objects) | Yes | List of questions/checks |

## **Data model: InspectionItem table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| item\_id | UUID | Yes | Unique item record |
| inspection\_id | Foreign Key | Yes | Parent inspection |
| template\_item\_id | Foreign Key | Yes | Link back to template item |
| item\_description | Text | Yes | e.g., “Piers installed at same elevation, checked with rotary laser.” |
| response | Enum | Yes | Yes, No, Not Applicable |
| comment | Text | No | Optional explanation |
| attached\_photos | Array (Photo IDs) | No | Evidence photos |
| order\_index | Integer | Yes | Display order in this inspection |

## **Data model: InspectionDistribution table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| distribution\_id | UUID | Yes | Unique record |
| inspection\_id | Foreign Key | Yes | Parent inspection |
| sent\_to | Foreign Key (User/Email) | Yes | Recipient (e.g., Amber) |
| cc\_list | Array (User/Email) | No | CCs (e.g., self) |
| sent\_timestamp | Timestamp | Yes | When report was emailed |

---

## **2\. Documents Library Module (from “Procore Basics: How to Use the Documents Tool”)**

## **What the video shows**

* The **Documents tool** is essentially a project file system:  
  * Stores estimates, specifications, and any other documents that are not drawings or photos.\[[ppl-ai-file-upload.s3.us-east-1.amazonaws](https://ppl-ai-file-upload.s3.us-east-1.amazonaws.com/web/direct-files/collection_ad0925b7-fc2b-4a5d-a764-bb279164a3cb/1503b0c6-4384-492e-9407-ccb0b0bced64/Problems-and-solutions-of-DT.docx?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYEUK3HBUMZ%2F20260712%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260712T190357Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIAfo6nt9x3u6VM2T8ZLAXzwuVVz7DRz7XUmR3l%2FHNCEEAiEAkyO0blXrj6YD4%2BP%2Fs6NLDjda%2BBQWVi1JwNWqSpnbA0oq9AQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDPdfoTI%2BHBkFGQUq8yrIBMSn%2FqNE9A11x68aegF47W%2Buute0J4aezPrGF%2BPhRen9V8xwxavnE%2BbjaC4vj37Oro0ih8XDcSGhJnUCanzdbLcMrG8yvoWaDc5OJZ7BeodSElj0nBI9fp%2F7YOEruVnt1Kpbh98xL2QZZVA1NvNgXfX1CTUTO5uFQjHwFhYRSsqSFyGSxn8lWeVh1LBLILYBP9zxwHnFmBMpA0619x%2FtIozKAE9ycF6Yyc0f2opEOeIMjYMiUpCJvWrp3vF1unQ0bYJGrMPq3opSPkdY0dOZjhI3PSx4TLTpV7CwYEm6a6WhPbzTNIb0qufeyScDN5gONtpDAOtlvQXNqxSpX0Byja7Y43roqGbrvqsolDTIXZd8JIsrb6SDdDAsVNEc%2FGYBp%2Byn43qiUCL2eu603iRp3pw4SM3vmVURS4TTFhFCcXHCAdTxB9ylmwbbQHhiK3YvbEm9kJt%2FH4KCH0K7U%2BBPXRJtefuUugsf4aAj2y9%2FgGFsUOWvCoan3sPCf6qFyJwdblXn0yWFl2yrusM1jQi6pjJwIf8%2FAR4hibpgpKeg1EvopuYRWsWlGyc3wWbPG7g%2BmZMdCTbcvjTatYp0T%2FZWQow3zrlwrgV%2Fao%2FYfce8mCS552hQ3jxqMuiPrITEkbMtMmTZ4RXx8xc7mEdfmUjSzGY9F3%2F37neq%2F0nBb7lGnYKZtPhSN1fjC1QtcmciVGeQ%2F8rwtmMxL1JVDTMIrLQRADC573PSgQ1AHCMMELyC5U4AXkCryNK9g57xPtn4HUWjeFNgcJXQXhvPMKe5z9IGOpgBu5YZQwH4oc2X1pQhzu%2FGlqXHCE149mPDP2qmIW4xboDaYTDIlZuGRp99LpIFCSprG1eHs5vg0C30%2BeQxdUIXYJQ2rnie7WQBIF3SIZgR530mYOsRg8DOivUB9miPNhiJb%2FteVndpNlnAXSHH8Pz9cgRbe5CgX%2FtsCwLy0msmVajUKMHKKIPZ9AqxBVfEsucgbYuBAtPyXQc%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=5bb0f02e2924107d03af268d425d0b39a1a39aaf5004e13c6e8152f581798eea)\]  
* Folder structure:  
  * Tree view of folders and subfolders.  
  * Each folder lists file count, and clicking a file opens the document.  
* Document actions:  
  * View (non-editable PDF/image rendering).  
  * Download (for local editing).  
  * Check Out (to mark that someone is editing).  
  * Re-upload (new version of a document).  
* Upload methods:  
  * Drag-and-drop from desktop.  
  * File picker (“upload file from your computer”).\[[ppl-ai-file-upload.s3.us-east-1.amazonaws](https://ppl-ai-file-upload.s3.us-east-1.amazonaws.com/web/direct-files/collection_ad0925b7-fc2b-4a5d-a764-bb279164a3cb/1503b0c6-4384-492e-9407-ccb0b0bced64/Problems-and-solutions-of-DT.docx?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYEUK3HBUMZ%2F20260712%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260712T190357Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIAfo6nt9x3u6VM2T8ZLAXzwuVVz7DRz7XUmR3l%2FHNCEEAiEAkyO0blXrj6YD4%2BP%2Fs6NLDjda%2BBQWVi1JwNWqSpnbA0oq9AQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDPdfoTI%2BHBkFGQUq8yrIBMSn%2FqNE9A11x68aegF47W%2Buute0J4aezPrGF%2BPhRen9V8xwxavnE%2BbjaC4vj37Oro0ih8XDcSGhJnUCanzdbLcMrG8yvoWaDc5OJZ7BeodSElj0nBI9fp%2F7YOEruVnt1Kpbh98xL2QZZVA1NvNgXfX1CTUTO5uFQjHwFhYRSsqSFyGSxn8lWeVh1LBLILYBP9zxwHnFmBMpA0619x%2FtIozKAE9ycF6Yyc0f2opEOeIMjYMiUpCJvWrp3vF1unQ0bYJGrMPq3opSPkdY0dOZjhI3PSx4TLTpV7CwYEm6a6WhPbzTNIb0qufeyScDN5gONtpDAOtlvQXNqxSpX0Byja7Y43roqGbrvqsolDTIXZd8JIsrb6SDdDAsVNEc%2FGYBp%2Byn43qiUCL2eu603iRp3pw4SM3vmVURS4TTFhFCcXHCAdTxB9ylmwbbQHhiK3YvbEm9kJt%2FH4KCH0K7U%2BBPXRJtefuUugsf4aAj2y9%2FgGFsUOWvCoan3sPCf6qFyJwdblXn0yWFl2yrusM1jQi6pjJwIf8%2FAR4hibpgpKeg1EvopuYRWsWlGyc3wWbPG7g%2BmZMdCTbcvjTatYp0T%2FZWQow3zrlwrgV%2Fao%2FYfce8mCS552hQ3jxqMuiPrITEkbMtMmTZ4RXx8xc7mEdfmUjSzGY9F3%2F37neq%2F0nBb7lGnYKZtPhSN1fjC1QtcmciVGeQ%2F8rwtmMxL1JVDTMIrLQRADC573PSgQ1AHCMMELyC5U4AXkCryNK9g57xPtn4HUWjeFNgcJXQXhvPMKe5z9IGOpgBu5YZQwH4oc2X1pQhzu%2FGlqXHCE149mPDP2qmIW4xboDaYTDIlZuGRp99LpIFCSprG1eHs5vg0C30%2BeQxdUIXYJQ2rnie7WQBIF3SIZgR530mYOsRg8DOivUB9miPNhiJb%2FteVndpNlnAXSHH8Pz9cgRbe5CgX%2FtsCwLy0msmVajUKMHKKIPZ9AqxBVfEsucgbYuBAtPyXQc%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=5bb0f02e2924107d03af268d425d0b39a1a39aaf5004e13c6e8152f581798eea)\]  
* Rendering:  
  * Uploaded files become viewable PDFs inside the app.  
* Typical use case:  
  * “Estimates” folder holds a garage estimate.  
  * The user can print, download, or send directly to the building supplier as a reference.\[[ppl-ai-file-upload.s3.us-east-1.amazonaws](https://ppl-ai-file-upload.s3.us-east-1.amazonaws.com/web/direct-files/collection_ad0925b7-fc2b-4a5d-a764-bb279164a3cb/1503b0c6-4384-492e-9407-ccb0b0bced64/Problems-and-solutions-of-DT.docx?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYEUK3HBUMZ%2F20260712%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260712T190357Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIAfo6nt9x3u6VM2T8ZLAXzwuVVz7DRz7XUmR3l%2FHNCEEAiEAkyO0blXrj6YD4%2BP%2Fs6NLDjda%2BBQWVi1JwNWqSpnbA0oq9AQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDPdfoTI%2BHBkFGQUq8yrIBMSn%2FqNE9A11x68aegF47W%2Buute0J4aezPrGF%2BPhRen9V8xwxavnE%2BbjaC4vj37Oro0ih8XDcSGhJnUCanzdbLcMrG8yvoWaDc5OJZ7BeodSElj0nBI9fp%2F7YOEruVnt1Kpbh98xL2QZZVA1NvNgXfX1CTUTO5uFQjHwFhYRSsqSFyGSxn8lWeVh1LBLILYBP9zxwHnFmBMpA0619x%2FtIozKAE9ycF6Yyc0f2opEOeIMjYMiUpCJvWrp3vF1unQ0bYJGrMPq3opSPkdY0dOZjhI3PSx4TLTpV7CwYEm6a6WhPbzTNIb0qufeyScDN5gONtpDAOtlvQXNqxSpX0Byja7Y43roqGbrvqsolDTIXZd8JIsrb6SDdDAsVNEc%2FGYBp%2Byn43qiUCL2eu603iRp3pw4SM3vmVURS4TTFhFCcXHCAdTxB9ylmwbbQHhiK3YvbEm9kJt%2FH4KCH0K7U%2BBPXRJtefuUugsf4aAj2y9%2FgGFsUOWvCoan3sPCf6qFyJwdblXn0yWFl2yrusM1jQi6pjJwIf8%2FAR4hibpgpKeg1EvopuYRWsWlGyc3wWbPG7g%2BmZMdCTbcvjTatYp0T%2FZWQow3zrlwrgV%2Fao%2FYfce8mCS552hQ3jxqMuiPrITEkbMtMmTZ4RXx8xc7mEdfmUjSzGY9F3%2F37neq%2F0nBb7lGnYKZtPhSN1fjC1QtcmciVGeQ%2F8rwtmMxL1JVDTMIrLQRADC573PSgQ1AHCMMELyC5U4AXkCryNK9g57xPtn4HUWjeFNgcJXQXhvPMKe5z9IGOpgBu5YZQwH4oc2X1pQhzu%2FGlqXHCE149mPDP2qmIW4xboDaYTDIlZuGRp99LpIFCSprG1eHs5vg0C30%2BeQxdUIXYJQ2rnie7WQBIF3SIZgR530mYOsRg8DOivUB9miPNhiJb%2FteVndpNlnAXSHH8Pz9cgRbe5CgX%2FtsCwLy0msmVajUKMHKKIPZ9AqxBVfEsucgbYuBAtPyXQc%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=5bb0f02e2924107d03af268d425d0b39a1a39aaf5004e13c6e8152f581798eea)\]  
* Mobile:  
  * Same folders and files appear on mobile.  
  * User can zoom, view version history, and send the document via message/email to someone not in Procore.\[[ppl-ai-file-upload.s3.us-east-1.amazonaws](https://ppl-ai-file-upload.s3.us-east-1.amazonaws.com/web/direct-files/collection_ad0925b7-fc2b-4a5d-a764-bb279164a3cb/1503b0c6-4384-492e-9407-ccb0b0bced64/Problems-and-solutions-of-DT.docx?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Checksum-Mode=ENABLED&X-Amz-Credential=ASIA2F3EMEYEUK3HBUMZ%2F20260712%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20260712T190357Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIAfo6nt9x3u6VM2T8ZLAXzwuVVz7DRz7XUmR3l%2FHNCEEAiEAkyO0blXrj6YD4%2BP%2Fs6NLDjda%2BBQWVi1JwNWqSpnbA0oq9AQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDPdfoTI%2BHBkFGQUq8yrIBMSn%2FqNE9A11x68aegF47W%2Buute0J4aezPrGF%2BPhRen9V8xwxavnE%2BbjaC4vj37Oro0ih8XDcSGhJnUCanzdbLcMrG8yvoWaDc5OJZ7BeodSElj0nBI9fp%2F7YOEruVnt1Kpbh98xL2QZZVA1NvNgXfX1CTUTO5uFQjHwFhYRSsqSFyGSxn8lWeVh1LBLILYBP9zxwHnFmBMpA0619x%2FtIozKAE9ycF6Yyc0f2opEOeIMjYMiUpCJvWrp3vF1unQ0bYJGrMPq3opSPkdY0dOZjhI3PSx4TLTpV7CwYEm6a6WhPbzTNIb0qufeyScDN5gONtpDAOtlvQXNqxSpX0Byja7Y43roqGbrvqsolDTIXZd8JIsrb6SDdDAsVNEc%2FGYBp%2Byn43qiUCL2eu603iRp3pw4SM3vmVURS4TTFhFCcXHCAdTxB9ylmwbbQHhiK3YvbEm9kJt%2FH4KCH0K7U%2BBPXRJtefuUugsf4aAj2y9%2FgGFsUOWvCoan3sPCf6qFyJwdblXn0yWFl2yrusM1jQi6pjJwIf8%2FAR4hibpgpKeg1EvopuYRWsWlGyc3wWbPG7g%2BmZMdCTbcvjTatYp0T%2FZWQow3zrlwrgV%2Fao%2FYfce8mCS552hQ3jxqMuiPrITEkbMtMmTZ4RXx8xc7mEdfmUjSzGY9F3%2F37neq%2F0nBb7lGnYKZtPhSN1fjC1QtcmciVGeQ%2F8rwtmMxL1JVDTMIrLQRADC573PSgQ1AHCMMELyC5U4AXkCryNK9g57xPtn4HUWjeFNgcJXQXhvPMKe5z9IGOpgBu5YZQwH4oc2X1pQhzu%2FGlqXHCE149mPDP2qmIW4xboDaYTDIlZuGRp99LpIFCSprG1eHs5vg0C30%2BeQxdUIXYJQ2rnie7WQBIF3SIZgR530mYOsRg8DOivUB9miPNhiJb%2FteVndpNlnAXSHH8Pz9cgRbe5CgX%2FtsCwLy0msmVajUKMHKKIPZ9AqxBVfEsucgbYuBAtPyXQc%3D&X-Amz-SignedHeaders=host&x-id=GetObject&X-Amz-Signature=5bb0f02e2924107d03af268d425d0b39a1a39aaf5004e13c6e8152f581798eea)\]

## **Data model: DocumentFile table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| document\_id | UUID | Yes | Unique file record |
| project\_id | Foreign Key | Yes | Project |
| folder\_id | Foreign Key | Yes | Parent folder |
| file\_name | String | Yes | Name of file, e.g., “Garage Estimate.pdf” |
| file\_url | String | Yes | Storage link |
| file\_type | String/Enum | Yes | PDF, DOCX, XLSX, etc. |
| checked\_out\_by | Foreign Key (User) | No | Who currently has it checked out |
| checked\_out\_timestamp | Timestamp | No | When it was checked out |
| version\_number | Integer | Yes | Current version of this file |
| previous\_version\_id | Foreign Key (self) | No | Link to previous version |
| uploaded\_by | Foreign Key (User) | Yes | Who uploaded this version |
| upload\_timestamp | Timestamp | Yes | When it was uploaded |

## **Data model: DocumentFolder table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| folder\_id | UUID | Yes | Unique folder ID |
| project\_id | Foreign Key | Yes | Project |
| parent\_folder\_id | Foreign Key (self) | No | For nested folders |
| folder\_name | String | Yes | e.g., “Estimates”, “Specifications” |
| created\_by | Foreign Key (User) | Yes | Who created folder |
| created\_timestamp | Timestamp | Yes | When folder was created |

## **Data model: DocumentShareLog table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| share\_id | UUID | Yes | Unique share record |
| document\_id | Foreign Key | Yes | Shared document |
| shared\_by | Foreign Key (User) | Yes | Who shared it |
| shared\_to | String (Email/User) | Yes | Recipient (including non-users) |
| channel | Enum | Yes | Email, Message, Link |
| timestamp | Timestamp | Yes | When shared |

---

## **How these plug into your app**

* **Quality inspections ↔ Checklists**: Your existing checklist module already has items and statuses. A Quality Inspection is essentially a templated checklist with assignees, due dates, and richer reporting. You can reuse the checklist item model and add inspection-specific fields.  
* **Quality inspections ↔ Photos**: Each inspection item can attach photos from your Photos module, giving evidence for “Yes/No/NA” responses.  
* **Documents ↔ everything**: Documents become a central file library:  
  * RFIs, Submittals, Meetings, and Design Coordination issues can all attach document\_ids instead of raw files.  
  * Version history and check-out/lock logic mean multiple users won’t accidentally overwrite the same spec or estimate.

You now have 11 modules modeled: RFIs, Drawings, Checklist, Photos, Submittals, Daily Log, Meetings, Communication Matrix, Design Coordination, Quality Inspections, and Documents.

# Directory / User Management Module (Communication…

## **Directory / User Management Module (Communication Matrix)** 

## **What the video shows**

* The Directory tool is where **project-level access control** happens — construction team members/managers add people to a specific project.[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)  
* Two ways to add someone:  
  1. **Bulk add from company directory** — search for an existing Procore user by name, select a **permission template** for them (role-based access level), and optionally hit **Notify** to email them that they've been added.[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)  
  2. **Add Person** (new user) — manually enter name, email, and assign a permission template if they don't already have an account; this sends an invitation email to join Procore.[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)  
* **Permission templates gate visibility** — e.g., a "Summer Staff" role might only see limited project data, while a "Construction Manager" sees much more.[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)  
* Optional profile fields (job title, phone number) can be filled in during creation, but users can edit these themselves once logged in.[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)  
* **Desktop-only restriction**: Adding people to a project cannot be done from the mobile app — only from the desktop platform.[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)

## **Data model: ProjectDirectory table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| directory\_entry\_id | UUID | Yes | Unique record linking a user to a project |
| project\_id | Foreign Key | Yes | Project being granted access to |
| user\_id | Foreign Key (User) | Yes | The person being added |
| permission\_template\_id | Foreign Key | Yes | Role-based access level assigned |
| added\_by | Foreign Key (User) | Yes | Who added this person |
| added\_timestamp | Timestamp | Yes | When they were added |
| notified | Boolean | Yes | Whether an email notification was sent |
| status | Enum | Yes | Invited, Active, Removed |
| removed\_timestamp | Timestamp | No | If access was later revoked |

## **Data model: PermissionTemplate table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| template\_id | UUID | Yes | Unique template ID |
| template\_name | String | Yes | e.g., "Summer Staff", "Construction Manager", "Client" |
| description | String | No | What this role can see/do |
| module\_permissions | JSON | Yes | Per-module access flags (View/Edit/Admin) for RFIs, Drawings, Photos, etc. |
| is\_company\_wide | Boolean | Yes | Whether usable across all projects or project-specific |

## **Data model: User table (extended)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| user\_id | UUID | Yes | Unique user identifier |
| name | String | Yes | Full name |
| email | String | Yes | Login/contact email |
| phone | String | No | Optional |
| job\_title | String | No | Optional, editable by user |
| company\_id | Foreign Key (Vendor/Company) | No | Which company they belong to |
| account\_status | Enum | Yes | Invited, Active, Deactivated |

# Action Plans (workflow checklists with sign-offs)…

**Action Plans** (workflow checklists with sign-offs) and **Classifications** 

---

## **1\. Action Plans Module (Ensuring work is done “the way it should be”)**

## **What the video shows**

* Action Plans are **company-level templates** that define workflows (steps, approvals, sign-offs) for things like:  
  * Site safety training  
  * Concrete pre-pour inspections  
  * PPE training  
  * Submittal/invoicing processes (“follow these 5 steps if you want to get paid”).\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
* At company level:  
  * Admins go to **Action Plans** in the Admin tools and create templates.  
  * Each template has:  
    * Name (e.g., “Concrete Inspection Process”).  
    * Type (Safety, Quality, Concrete, Electrical, etc.).  
    * Description (rich text describing what the plan is for).  
    * Sections and steps (1.1, 1.2…) each with acceptance criteria, references, assignees, and records to attach (photos, previous inspections, etc.).\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
  * Each step has **assignees** with roles like:  
    * Subcontractor: Witness or Perform Test.  
    * General Contractor: Hold Point — cannot proceed until they sign/approve.  
* Publishing template:  
  * Once all sections/steps are defined, template is **published** and becomes available on all projects.\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
* At project level:  
  * Supers/PMs go to **Action Plans** tool for that job and click **Create**.  
  * Choose a published template (e.g., “Concrete Inspection Process”).  
  * Fill project-specific fields: location, plan manager, approver(s), distribution list, etc.  
  * Then each step is:  
    * Marked done with date.  
    * Signed electronically by required assignees before the plan can progress to next step.  
* Multiple plans per job:  
  * A single template can be used to create dozens of plans on one job (e.g., multiple OSHA training sessions for different trades).\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
* Procore keeps a **permanent record** of every signature and step completion, with unlimited template storage.\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]

## **Data model: ActionPlanTemplate table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| template\_id | UUID | Yes | Unique template identifier |
| company\_id | Foreign Key | Yes | Company that owns the template |
| template\_name | String | Yes | e.g., “Concrete Inspection Process” |
| type | String/Enum | Yes | Safety, Quality, Concrete, Electrical, etc. |
| description | Text (rich) | Yes | Steps for certified inspection, etc. |
| created\_by | User FK | Yes | Who created the template |
| created\_timestamp | Timestamp | Yes | When created |
| is\_published | Boolean | Yes | Whether usable on projects |

## **Data model: ActionPlanTemplateSection table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| section\_id | UUID | Yes | Section identifier (e.g., 1.0) |
| template\_id | Foreign Key | Yes | Parent template |
| section\_title | String | Yes | e.g., “Verify proper installation of forms” |
| order\_index | Integer | Yes | Display order |

## **Data model: ActionPlanTemplateStep table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| step\_id | UUID | Yes | Step identifier (e.g., 1.1, 1.2) |
| section\_id | Foreign Key | Yes | Parent section |
| step\_description | Text | Yes | e.g., “Excavation must be inspected” |
| acceptance\_criteria | Text | Yes | e.g., “Must be signed by Sub and GC” |
| reference\_attachments | Array (Document/Photo IDs) | No | Linked docs/photos |
| required\_assignees | Array (Assignee role objects) | Yes | Roles and their duty (Witness, Perform Test, Hold Point) |

## **Data model: ActionPlanInstance (Project-level plan)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| plan\_id | UUID | Yes | Unique plan record |
| project\_id | Foreign Key | Yes | Project |
| template\_id | Foreign Key | Yes | Template this plan uses |
| plan\_name | String | Yes | Name shown on project |
| location | String | No | Project location for this plan |
| plan\_manager | User FK | Yes | Owner of the plan |
| approvers | Array (User IDs) | No | People who approve final plan |
| status | Enum | Yes | Draft, In Progress, Completed |
| created\_by | User FK | Yes | Who instantiated the plan |
| created\_timestamp | Timestamp | Yes | When created |

## **Data model: ActionPlanInstanceStep (per plan, per step)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| instance\_step\_id | UUID | Yes | Unique record |
| plan\_id | Foreign Key | Yes | Parent plan |
| template\_step\_id | Foreign Key | Yes | Source template step |
| completion\_date | Date | No | When step was performed |
| status | Enum | Yes | Pending, Awaiting Signatures, Completed |
| assignee\_signatures | Array (Signature objects) | No | Captured sign-offs (sub \+ GC) |
| records | Array (linked Document/Photo/Inspection IDs) | No | Evidence attached during execution |

---

## **2\. Classifications Module (job titles tied to cost tracking)**

## **What the video shows**

* Classifications are created **at company level**:  
  * Admin goes to Company → Admin → Classifications.\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
  * Adds titles like:  
    * Project Manager (PM1)  
    * Senior Project Manager (PM2)  
    * Drywall Installer (DWC)  
    * Superintendent (SU1).\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
* Each classification has:  
  * Title (human-readable job role).  
  * Code (short code used for reporting, e.g., “PM2”, “DWC”).\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
* Applying classifications:  
  * At **project directory** level, edit each user or vendor’s record.  
  * Select classification from a dropdown and save.  
  * This classification is then used across:  
    * Timesheets / time cards.  
    * Daily logs / manpower.  
    * Resource management and crews.\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]  
* Reporting:  
  * Later, you can run filters/reports by classification:  
    * Total spent on “Senior Project Managers” vs “Superintendents”.  
    * Total cost of “Drywall Installers” across several jobs, etc..\[[ppl-ai-file-upload.s3.amazonaws](https://ppl-ai-file-upload.s3.amazonaws.com/web/direct-files/attachments/7932656/202c8eb1-c87c-451a-bc27-de8f78dbffed/Cashflow-Dashboard.xlsx?AWSAccessKeyId=ASIA2F3EMEYE5F3NLFTN&Signature=bsJf17y2TZz8AaC6rwpGbwOjVL0%3D&x-amz-security-token=IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIQD%2BrDGb5JpX7Z2OgjrSlr43N9lo%2FdpCoyzDTZzkfD0RPwIgZd3kXb0cWRstyMT3IMA3vHxaJYIErXJBuzZghEsSu1Yq%2FAQI7P%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FARABGgw2OTk3NTMzMDk3MDUiDCG91NXAF9pcyHxEiCrQBPf6c1lHdDzu7lb36X7rIExuiKRHoxQb2qwT8nWORTt32d6FROsJP4Gk259DOwlolkZhAWanFP5W0SBrK1aq5zQBEnZOMZ5UUxiMDfmqNk7MOKk5nK%2FuCGIPREZDR%2BRcivrVtuHBGAbO6eIzPYPjY5I3u5iM5AjLiBCFvF7osWVpKSjRYGGBrjnc8bcBhRyz%2BUzbLoEempelPum4xSOC4JW2r7dZR4leQvWizS9bFrRE5ZrGaQDebaA8geoDRUsGNIF6JOUaS5JxSpul5%2FnKxfPfqlC2hw0DORGH2poYqstnRSQE3jyUtOrW%2F0kxxN5HWWWVCvOvcb5VPqDzAMXQDGFCU8InagkSIsCu2T4e3HHFp9f2ek%2BnPyQkt5tBLGZfxDDkitlH8MduG3ExYwj5xrX8BEMjZs56MG4pnyttC1EPJGg2KZExtEbq5UNW8RzLsMyo3GJW5b%2BZLsMtLzPPmMlXTQMLUoP%2Fd4PsP%2FLyy7dWPGiUSrsbSE4LUDfOmV2Yy4vPS7%2BSa%2FjZQpYjJ11vrAvPP2rl9Ve3b29d2aYt2A5Q55YFRHN6tgh%2Bu%2BBzhFTkQz2ONjoXN3HpmNejv3M1jzLb64njraY67nHzHEkP1wHgMvV9HuKLy1ha%2BYZ2LzHc8f0ELe1Hudd76RUWiaf7yeaHg1MnPGQOPAbKBcL3Swm96SwV4%2BvEtarbjHK46L60B7OqXxPd3blcbra6GgTp7c8UROhaqtSbvi50DxOg%2BqweB%2BOYVtW4WnmKz79coTXZ2Cu%2BGEek0fUoXEFkANc37MwwpL3P0gY6mAGcBHGzJdKXX9tOywmW1TkQ%2FOssqHyD9OYy%2BxkOuCd6aWV20bRLg%2FzVt7%2BOMmT6U575EU43lSPqS%2BfitlCQ3leRIIYXfEybCNfU4P7zba%2FghErmZPah5Gt6Frh3u999np5vbv3xLtRa5h7VftNYcFQxX9RE6Ca8WxJ%2BusVD%2FflXf4TIxqkSMJOxrANztV4BMiD%2BrWulkc4pVg%3D%3D&Expires=1783884919)\]

## **Data model: Classification table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| classification\_id | UUID | Yes | Unique classification ID |
| company\_id | Foreign Key | Yes | Company |
| title | String | Yes | e.g., “Senior Project Manager”, “Drywall Installer” |
| code | String | Yes | Short code (PM2, DWC, SU1) |
| active | Boolean | Yes | Whether usable in new assignments |

## **Data model: UserClassificationAssignment table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| assignment\_id | UUID | Yes | Unique record |
| user\_id | Foreign Key (User) | Yes | Person being classified |
| project\_id | Foreign Key | Yes | Project where this classification applies |
| classification\_id | Foreign Key | Yes | Job title/code assigned |
| effective\_from | Date | No | Start date (for cost history) |
| effective\_to | Date | No | End date (if changed later) |

Then, your **Timesheets, Daily Logs (Manpower), and Resource Management** tables should store a `classification_id` per entry so you can aggregate costs/work hours by role.

---

## **How these plug into your existing ecosystem**

* **Action Plans ↔ Inspections, Submittals, Safety**: Action Plans are like “meta-checklists” that sit over inspections, safety training, invoicing, etc. You can:  
  * Attach inspections or photos as Records to each step.  
  * Use “Hold Points” to gate when a plan can progress, similar to approvals in Submittals and RFIs.  
* **Classifications ↔ Timesheets, Daily Logs, Resource Management**:  
  * Each timesheet row and daily manpower entry should reference a classification\_id.  
  * That lets you pull cost and manpower reports per role (PM vs Superintendent vs Trades) across all jobs — exactly what the video emphasises.

You now have 15 modules modeled, and Action Plans in particular act as a powerful **process layer** over many of them.

# Vendor/Company Directory Import and the subcontra…

**Vendor/Company Directory Import** and the **subcontractor-side Submittal markup workflow**. Let's model them.

---

## **1\. Vendor/Company Import Module**

## **What the video shows**

* Companies and Vendors are treated as the same entity type in Procore — anyone you do business with (suppliers, subcontractors, clients).\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]  
* Stored at the **company-level directory** (not project level), with fields including: address, primary contact, website, union status, insurance verification, license numbers, pre-qualified bidder status, diversity ownership status (women/minority-owned), and attached files (insurance certs, licenses).\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]  
* Adding one company at a time is fine for small numbers, but becomes unmanageable at scale (e.g., merging with a company that has 3,000-4,000 vendors).\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]  
* **Bulk import tool** (a separate downloadable desktop app):  
  * Log in with same credentials.  
  * Choose target company.  
  * Optionally choose a specific project — if selected, vendors are imported to both company level AND duplicated/assigned to that project simultaneously.\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]  
  * Choose action: Add New Vendors (vs. Bulk Edit existing).  
  * Download a blank Excel template — **only "Name" is a required field** (marked red); everything else (address, city, state, phone, insurance info, etc.) is optional and green, fillable later.\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]  
  * Drag-and-drop or browse to upload the filled template.  
  * Tool validates and previews (e.g., "5 records will be imported") before committing.  
  * Security confirmation step (re-type company name) before final import.\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]  
* After import, all vendors appear in the company directory, and admins can go back and manually fill in additional details incrementally.\[[reddit](https://www.reddit.com/r/ConstructionManagers/comments/1pje2fs/how_do_your_pes_take_team_meeting_notes/)\]

## **Data model: Company/Vendor table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| company\_vendor\_id | UUID | Yes | Unique identifier |
| parent\_company\_id | Foreign Key | Yes | Your own company account this vendor is stored under |
| name | String | **Yes (only mandatory field)** | Company/vendor name |
| address | String | No | Street address |
| city | String | No | City |
| state | String | No | State (must be filled together with country) |
| country | String | No | Country (must be filled together with state) |
| business\_phone | String | No | Contact number |
| website | String | No | Company website |
| primary\_contact\_id | Foreign Key (User) | No | Main point of contact |
| is\_union\_member | Boolean | No | Union status |
| is\_prequalified\_bidder | Boolean | No | Pre-qualification status |
| is\_minority\_owned | Boolean | No | Diversity ownership flag |
| is\_women\_owned | Boolean | No | Diversity ownership flag |
| license\_number | String | No | License info |
| insurance\_verified | Boolean | No | Whether insurance has been checked |
| insurance\_documents | Array (Document IDs) | No | Attached insurance/license files |
| created\_via | Enum | Yes | Manual, Bulk Import |
| import\_batch\_id | Foreign Key | No | Links to the import batch if bulk-created |

## **Data model: VendorImportBatch table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| batch\_id | UUID | Yes | Unique import batch |
| company\_id | Foreign Key | Yes | Target company account |
| project\_id | Foreign Key | No | If set, vendors are also duplicated to this project |
| imported\_by | Foreign Key (User) | Yes | Who ran the import |
| import\_type | Enum | Yes | Add New Vendors, Bulk Edit |
| source\_file\_url | String | Yes | Uploaded Excel template |
| record\_count | Integer | Yes | Number of records processed |
| status | Enum | Yes | Previewed, Confirmed, Completed, Failed |
| timestamp | Timestamp | Yes | When the import ran |

## **Data model: VendorProjectAssignment table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| assignment\_id | UUID | Yes | Unique record |
| company\_vendor\_id | Foreign Key | Yes | The vendor |
| project\_id | Foreign Key | Yes | Project they're assigned to |
| assigned\_via | Enum | Yes | Manual, Bulk Import |
| assigned\_timestamp | Timestamp | Yes | When assigned |

---

## **2\. Subcontractor Submittal Markup Workflow**

This is the **subcontractor-facing side** of your Submittals module — extends what we built earlier with concrete field-level detail.

## **What the video shows**

* Subcontractors receive an **email notification** saying "ball is in your court" for a specific submittal, with their info pre-filled.\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]  
* Inside Procore, submittals are grouped into **packages** by trade (e.g., "HVAC package" containing Mini Splits, Heaters, Hangers/Fasteners/Boots as separate submittal items).\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]  
* If a required item is missing from the requested package (e.g., an electric heater not covered by the listed items), the subcontractor is expected to flag/clarify this — showing a real gap in strict package-based tracking.\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]  
* **Markup process** happens **outside Procore** first:  
  * Download the cut sheet/spec sheet PDF.  
  * Open in a markup tool (BlueBeam, Adobe, etc.).  
  * Circle, highlight, or bubble the exact model/option being provided (critical when multiple similar model numbers exist, e.g., "RK0912BU" vs "RX" — tiny naming differences matter).\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]  
  * Save the marked-up file locally with a clear naming convention (e.g., "Greenwave West Bridgewater mini split submittal").\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]  
* Back in Procore:  
  * Navigate to the specific submittal item.  
  * Click **Respond → Attach**, upload the marked-up file.  
  * Set response status (e.g., "Submitted for approval").  
  * Add a text comment for the design team if needed.  
  * Click **Preview**, then **Respond** — this triggers an automatic email to the assigned reviewer (e.g., PM) confirming the response was submitted.\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]  
* **Best practice enforced by the GC**: one PDF per submittal item — don't combine multiple items (e.g., don't put mini splits and heaters in the same file), so reviewers aren't stuck sifting through 75 combined pages.\[[ifieldsmart](https://www.ifieldsmart.com/blogs/revolutionizing-construction-communication-the-power-of-rfi-construction-management-software/)\]

## **Data model additions to your existing Submittals tables**

Extend `SubmittalWorkflowStep` (from earlier) with:

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| markup\_tool\_used | Enum | No | BlueBeam, Adobe, Other — for internal tracking/audit only |
| response\_file\_naming | String | No | Enforced or suggested naming convention |
| package\_id | Foreign Key | Yes | Groups this submittal item under a trade package |

## **Data model: SubmittalPackage table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| package\_id | UUID | Yes | Unique package identifier |
| project\_id | Foreign Key | Yes | Project |
| trade | Enum/String | Yes | e.g., HVAC, Electrical, Plumbing |
| package\_name | String | Yes | e.g., "HVAC Package" |
| assigned\_vendor\_id | Foreign Key (Company/Vendor) | Yes | Subcontractor responsible for the whole package |

## **Data model: SubmittalPackageItem table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| package\_item\_id | UUID | Yes | Unique item within a package |
| package\_id | Foreign Key | Yes | Parent package |
| submittal\_id | Foreign Key | Yes | Links to the actual Submittal record |
| item\_title | String | Yes | e.g., "Mini Splits", "Heaters", "Hangers, Fasteners & Boots" |
| is\_scope\_gap\_flagged | Boolean | No | Flags if subcontractor identified a missing/unclear scope item (e.g., the electric heater question) |
| scope\_gap\_comment | Text | No | Explanation of the ambiguity |

## **Data model: SubmittalMarkupFile table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| markup\_file\_id | UUID | Yes | Unique file record |
| submittal\_id | Foreign Key | Yes | Parent submittal |
| uploaded\_by | Foreign Key (User) | Yes | Subcontractor who uploaded it |
| file\_url | String | Yes | Marked-up PDF |
| markup\_description | Text | No | e.g., "Circled model RK0912BU as the unit being provided" |
| upload\_timestamp | Timestamp | Yes | When uploaded |
| notification\_sent | Boolean | Yes | Whether reviewer was auto-emailed on response |

---

## **How these connect to your existing ecosystem**

* **Vendor Import ↔ Directory/Permissions**: Once vendors are bulk-imported at company level, assigning them to a specific project should auto-create their `ProjectDirectory` entry (from the earlier Directory module) — but note that actual **login access** (user accounts) is separate from **vendor/company records**, since a "vendor" here is a business entity, while "users" are individual people who may or may not have login credentials.  
* **Vendor Import ↔ Submittals/Packages**: The `assigned_vendor_id` in `SubmittalPackage` should pull directly from this Company/Vendor table, so once a subcontractor is imported and assigned to a project, they can immediately be tagged as responsible for specific submittal packages.  
* **Scope-gap flagging**: This is a small but valuable addition your competitors likely don't have — letting a subcontractor flag "this package is missing an item I need clarification on" creates a natural bridge to auto-generate an RFI, similar to the Checklist → RFI and Design Coordination → RFI patterns you've already built.

You now have 17 modules modeled: RFIs, Drawings, Checklist, Photos, Submittals (+ Packages \+ Markup), Daily Log, Meetings, Communication Matrix, Design Coordination, Quality Inspections, Documents, Directory/Permissions, Action Plans, Classifications, and Vendor/Company Import.

# Daily Reports for Specialty Contractors

**Daily Reports for Specialty Contractors**, 

with a focus on offline mobile capture, T\&M tickets, and safety compliance — let's extend your Daily Log module with these.

## **Procore Daily Reports — Key Features (Specialty Contractor Focus)**

* **Offline-first mobile capture**: Field teams can complete daily reports entirely from a mobile device, even with no internet or network access — data syncs automatically once connectivity returns, which is critical for site compliance in low-signal locations.  
* **Weather and safety incident logging**: Daily reports capture weather conditions and safety incidents as standard fields, not optional extras — reinforcing that safety documentation should be a first-class citizen in your Daily Log, not bolted on.  
* **Equipment tracking**: Equipment used each day is logged directly in the report (mirroring what we modeled earlier in `DailyLogEquipment`), with the video emphasizing this as a compliance and cost-tracking necessity.  
* **Progress bar validation**: A visible completion indicator nudges field teams to finish all required sections before submitting — similar to the "items inspected X of Y" pattern we saw in Quality Inspections.  
* **Time & Materials (T\&M) Tickets**: A distinct sub-feature for specialty/subcontractors — captures labor hours, materials used, and equipment for billable work outside the base contract scope, with **digital signatures captured on-site** from the general contractor's representative in real time, giving instant proof of work performed for billing disputes.  
* **Photo capture tied to daily reports**: Site photos are attached directly to the day's report (consistent with your existing Photos module integration).  
* **Single-click distribution**: Completed daily reports and T\&M tickets can be shared with project stakeholders instantly from the field, rather than requiring a return-to-office step.  
* **Library access for reference documents**: Field teams can access project plans/PDFs directly from their pocket while completing reports, so they can cross-reference drawings without switching apps.  
* **Job Hazard Analysis (JHA) capture**: A structured safety form for identifying job-specific hazards, filled out as part of the daily documentation flow — this should sit alongside your Daily Log/Safety data.  
* **Real-time GC visibility**: General contractors get live insight into specialty contractor field data and any financial changes (via T\&M tickets) as they happen, not after the fact.

## **Data model: T\&M Ticket table (new)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| tm\_ticket\_id | UUID | Yes | Unique ticket identifier |
| project\_id | Foreign Key | Yes | Project |
| daily\_log\_id | Foreign Key | No | Linked daily log entry, if applicable |
| contractor\_id | Foreign Key (Vendor) | Yes | Specialty contractor submitting the ticket |
| work\_description | Text | Yes | Description of billable extra work performed |
| labor\_entries | Array (Labor objects) | No | Worker, hours, rate per worker |
| material\_entries | Array (Material objects) | No | Material used, quantity, unit cost |
| equipment\_entries | Array (Equipment objects) | No | Equipment used, hours, rate |
| total\_amount | Decimal | Yes | Auto-calculated billable total |
| status | Enum | Yes | Draft, Submitted, Signed, Disputed, Approved |
| signed\_by | Foreign Key (User) | No | GC representative who signed on-site |
| signature\_timestamp | Timestamp | No | When signed |
| signature\_data | String/Image | No | Captured digital signature |
| created\_by | Foreign Key (User) | Yes | Who created the ticket |
| created\_timestamp | Timestamp | Yes | When created |

## **Data model: JobHazardAnalysis table (new)**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| jha\_id | UUID | Yes | Unique JHA record |
| daily\_log\_id | Foreign Key | Yes | Linked daily log |
| task\_description | Text | Yes | Task being analyzed |
| hazards\_identified | Array (Hazard objects) | Yes | List of hazards and mitigation steps |
| completed\_by | Foreign Key (User) | Yes | Who filled out the JHA |
| completed\_timestamp | Timestamp | Yes | When completed |

## **Data model additions to your existing DailyLog table**

| Field Name | Data Type | Required | Description |
| ----- | ----- | ----- | ----- |
| offline\_sync\_status | Enum | Yes | Synced, Pending Sync, Sync Failed |
| weather\_incident\_flag | Boolean | No | Whether unusual weather affected work |
| safety\_incident\_flag | Boolean | No | Whether a safety incident occurred |
| completion\_percentage | Decimal | Yes | Progress indicator for required sections |
| library\_documents\_referenced | Array (Document IDs) | No | Plans/PDFs accessed during report completion |

## **How this connects to your existing modules**

* **T\&M Tickets ↔ Budget/Cashflow**: This is the most valuable addition here — T\&M tickets represent unbudgeted, billable extra work, so they should feed directly into your Cashflow Dashboard as a "Pending Extra Claims" line item, separate from the planned budget, giving Sharnam-style PMC oversight of scope creep in near real-time.  
* **T\&M Tickets ↔ Submittals/Invoicing**: Once signed, a T\&M ticket is essentially pre-approved billing evidence — it should be attachable directly to an invoice/submittal package rather than requiring re-entry.  
* **JHA ↔ Daily Log**: Safety documentation ties naturally into your daily log as a required sub-form, and could optionally gate report submission (i.e., "you cannot submit today's log until JHA is completed"), similar to how Action Plan "Hold Points" work.  
* **Offline sync pattern**: This reinforces the same **queue-based sync architecture** we designed for the Photos module — your app should treat *all* field data (photos, daily logs, T\&M tickets, JHAs) with the same offline-first, queue-and-sync pattern, since site connectivity is a recurring theme across nearly every video you've shared.

