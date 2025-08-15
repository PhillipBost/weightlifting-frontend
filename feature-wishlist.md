##### Grouped by type, then listed roughly in order of priority but also ease of implementation because I want to do the easy things first


#### Athlete Page Feature

- Athlete cards
- [Radar Chart](https://recharts.org/en-US/examples/SimpleRadarChart) showing make rate percentage for snatch 1, snatch 2, snatch 3, etc. Possibly have a separate radar chart showing bomb-out likelihood (displayed inversely), overall snatch success rate, overall c&j success rate, overall success rate percentage
  - Would be nice to have all time radar charts as well as last four meets. Or local vs. all other higher stakes meets to sort of gauge how the athlete performs under pressure
- Customize Date Range of Athlete Results
- % Success Rate in Snatch, C&J, and All Attempts
- YOY % Progress in Total both in tabular and graphically. Floating bar chart could be the move especially if I could also fit in YOY % progress for snatch and C&J on the same chart (overlapping bar charts could create a tricky mess though). This would likely be best handled using the materialized views feature within Supabase.
- Athlete page result table with links to meet results pages
- Athlete Page -- Overall Placement at National and International Events
- Athlete-to-Athlete Comparisons (potentially housed within the athlete page)
- [Banded chart](https://recharts.org/en-US/examples/BandedChart) for athletes (particularly youth) which have their current q-score data and then extrapolates out based on average YOY% percentage change and an upper band representing highest YOY% ever achieved and lower band representing... I'm not sure... lowest YOY% ever acheived (within reason)? Just have the lower band match the higher band but in the opposite direction? 


#### Meet Results Page Features

- Meet Results Pages (with links to athlete pages for participating athletes)
- Meet Rankings by division, age group rankings determind by q-scores (youth, junior, senior, and masters)
- [Choropleth map](https://www.data-to-viz.com/graph/choropleth.html) within national & international meet result pages which show increased opacity for how much each WSO was represented overlayed with a [bubblemap](https://d3-graph-gallery.com/bubblemap) which shows which (and to what degree) various barbell club members participated
- Data visualizations within meet results pages (scatter plots, Q-score distribution, etc)


#### Backend / Database Features

- IWF Results
- Historical National USA Results prior to 2012
- Delineate US athletes vs. international athletes ([openweightlifting.org](https://www.openweightlifting.org/) does this well).
- Country Tagging/Grouping (IWF results is a prerequisite)


#### WSO / Barbell Club page features

- [TreeMap](https://recharts.org/en-US/examples/CustomContentTreemap) showing colorful sections representing WSOs and various sized blocks within representing barbell clubs. I think this one might actually be too tricky...


#### Home page / General features

- Provide link to github
- About page & link to about page
- Consider possible user interface accessibility issues & address
- Figure out a way to offset recurring hosting costs--possibly including athlete names within search bar alongside former olympians


#### Rankings page

- Year by year rankings for all relavent divisions determined by total
  - Current year would begin at Jan 1 and be as up to date as possible
  - Rolling 11-to-12 month calendar would be as up to date as possible
- Year by year rankings for all age groups (youth, junior, senior, masters) determined by q-points
  - Current year would begin at Jan 1 and be as up to date as possible
  - Rolling 11-to-12 month calendar would be as up to date as possible
- Year by year WSO rankings for all age groups (youth, junior, senior, masters) determined by q-points


#### Statistics page

- Mostly want to see broad population data
  - distribution of all three q-scores for all athletes.
  - scatter plots
  - YOY participation trends by division


#### Tiered user access / roles

- Better-Auth


#### Known issues / bugs

- Result tables on athlete pages give the correct number of results above the table, but at the bottom it usually tells you a different number if there are more than 20 meets.
