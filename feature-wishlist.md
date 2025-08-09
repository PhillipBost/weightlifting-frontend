Listed roughly in order of priority but also ease of implementation


#### Big Ideas

- Athlete cards
- [Radar Chart](https://recharts.org/en-US/examples/SimpleRadarChart) showing make rate percentage for snatch 1, snatch 2, snatch 3, etc. Possibly have a separate radar chart showing bomb-out likelihood (displayed inversely), overall snatch success rate, overall c&j success rate, overall success rate percentage
  - Would be nice to have all time radar charts as well as last four meets. Or local vs. all other higher stakes meets to sort of gauge how the athlete performs under pressure
- Customize Date Range of Athlete Results
- % Success Rate in Snatch, C&J, and All Attempts
- YOY % Progress in Total
- Meet Results Pages (with links to athlete pages for participating athletes)
- Athlete page result table with links to meet results pages
- [Choropleth map](https://www.data-to-viz.com/graph/choropleth.html) within national & international meet result pages which show increased opacity for how much each WSO was represented overlayed with a [bubblemap](https://d3-graph-gallery.com/bubblemap) which shows which (and to what degree) various barbell club members participated
- Data visualizations within meet results pages (scatter plots, Q-score distribution, etc) 
- IWF Results
- Delineate US athletes vs. international athletes ([openweightlifting.org](https://www.openweightlifting.org/) does this well).
- Athlete Page -- Overall Placement at National and International Events
- Athlete-to-Athlete Comparisons (potentially housed within the athlete page)
- Country Tagging/Grouping (IWF results is a prerequisite)
- Barbell Club / WSO page with TreeMap showing colorful sections representing WSOs and various sized blocks within representing barbell clubs. I think this one might actually be too tricky...
- [Banded chart](https://recharts.org/en-US/examples/BandedChart) for athletes (particularly youth) which have their current q-score data and then extrapolates out based on average YOY% percentage change and an upper band representing highest YOY% ever achieved and lower band representing... I'm not sure... lowest YOY% ever acheived (within reason)? Just have the lower band match the higher band but in the opposite direction? 

#### Smaller / easier to implement ideas

- Provide link to github
- Add Vercel analytics functionality
- About page
- Result tables on athlete pages give the correct number of results above the table, but at the bottom it usually tells you a different number if there are more than 20 meets.
- Address the database bug(?) where some athletes have older barbell club / WSO affiliations linked to their profile
