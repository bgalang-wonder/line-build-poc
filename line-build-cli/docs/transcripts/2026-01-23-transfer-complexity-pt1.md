 # Modeling Line Build Transfer Complexity and Workflow Steps
 
 **Date:** January 23, 2026  
 **Participants:** Brandon (Me), Shin
 
 ## Summary
 
 Discussion on how to model transfers and their complexity, distinguishing between different types of movement in the kitchen.
 
 ## Key Topics Discussed
 
 ### Inter-Station Transfer Complexity
 - Inter-station transfers on hot line are difficult
 - Cook something → disappears from screen → comes back → use another equipment
 - Instructions resurface (surfacing old information is complexity)
 - AI agent recognized this pattern as inefficient
 
 ### Simplification for Complexity Scoring
 - Generalized: all station-to-station transfers weighted same as pod-to-pod
 - Turbo to fryer = turbo to garnish = fryer to garnish (same weight)
 - Exception: transfers within cold pod (garnish) don't count as heavily
 
 ### Transfer Steps Purpose
 - Capture **time** for transfer (not just complexity weight)
 - May impact sequencing if requires a person
 - Two dimensions: harder operation + time/movement accounting
 
 ### Storage Locations
 - Cold rail, dry rail, cold storage, packaging, freezer = one-way streets
 - Can only retrieve from these, not place
 - Time to find things varies by storage type (rails easier than cold storage)
 
 ### Retrieve vs Place Actions
 - **Retrieve**: Start at station B, go get thing from A
 - **Place**: Have thing at A, go put it at B
 - **From/To**: General movement (doesn't specify who moved it)
 - Retrieve/Place encodes directionality and actor
 
 ## Key Insight
 
 > "Transfer step in spreadsheet just says 'get from station' and gives 2 points. This [new system] has better information because instead of manually typing consistent format, it just does it. Score will be more accurate and repeatable."
 
 ---
 
 ## Full Transcript
 
 [Transcript content preserved for reference - see original meeting recording]
