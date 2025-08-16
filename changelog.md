| Date of update | Description |
| -------------- | ----------- |
| 8-16-2025      | - Fixed nightly division scraper to now update WSO and barbell club info <br> Fixed issue where result tables on athlete pages gave the correct number of results above the table, but at the bottom it told you a different number (in intervals of 20) if there were more than 20 meets. <br> Added Level (local, national, international, etc.) to expanded meet results section within athlete page. <br> Made light theme a little less harsh on the eyes. |
| 8-15-2025      | Created Light & High-Contrast themes <br> Fixed search to include most recent WSO & barbell club information <br> Added former Olympians (etc) to suggested search |
| 8-14-2025      | Added GitHub link to home page and reformatted footer. |
| 8-12-2025      | Q-scores for athletes <12 in age or <40 kg bodyweight were assigned NULL q-scores since these ages and weights tend to produce wild numbers. This will be done automatically by Supabase moving forward. <br> Also removed some obvious outliers from the database. If intent behind typo was obvious, I fixed it. If I wasn't sure, value was set to NULL. |
| 8-11-2025      | Table compact/expanded button with csv export to match WSO & Club columns added to expanded results table |
| 8-10-2025      | Expanded README.md |
| 8-9-2025       | Added vercel analytics functionality & github changelog & github feature wishlist |
| 8-8-2025       | Went live on vercel hosted site   |
