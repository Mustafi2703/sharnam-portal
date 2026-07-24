# DPR generation

Generate from **site day log + registers** into the client Excel layout.

## Pack sections (from `DPR-Sharnam PMC- ARVIND LIMITED (3).xlsx`)

1. **Summary** — project, client, consultant, PMC  
2. **Manpower, Equipments, Materials**  
3. **Concern Register** — building, concern, impact, responsibility, day status  
4. **Hindrance Register** — linked to Progress hindrance  
5. **Daily Progress Dashboard**  
6. **Site Photographs**  
7. **Checklist fills by type** — SiteExecution (site), DrawingCheck, QualityInspection, Safety  

## UI

Reports → **Generate DPR** for selected date → download HTML/JSON matching template. Site users fill day log; office generates pack.

## Checklist type rules

| Fill type | DPR section |
|-----------|-------------|
| SiteExecution | Site execution checklists |
| DrawingCheck | Drawing check fills |
| QualityInspection | Quality inspection fills |
| Safety | Safety checklist fills |
