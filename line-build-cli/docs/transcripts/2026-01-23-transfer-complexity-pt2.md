 # HDR Line Build Complexity Mapping with Transfers and Stations
 
 **Date:** January 23, 2026  
 **Participants:** Brandon (Me), Shin
 
 ## Summary
 
 Deep dive into transfer modeling, station configuration, and how to derive complexity from HDR layouts.
 
 ## Key Topics Discussed
 
 ### Transfer Types and Complexity
 - **Sublocation to sublocation**: Within same station (low complexity)
 - **Station to station**: Between different stations (medium complexity)
 - **Pod to pod**: Between different pods (higher complexity)
 - For MVP: Treat inter-station transfers same as inter-pod (simplification)
 
 ### Material Flow Visualization
 - Shows where components come from (cold rail, dry rail, cold storage, packaging)
 - Colored lines connect to HDR location (cold rail, cold storage, etc.)
 - Transfer steps appear explicitly in work order view
 
 ### HDR Configuration
 - Default site layouts (D1-D5) stored in Portal
 - D3 is typical "bread and butter" layout
 - D5 (Westfield) is more complex with more pod types
 - Use default to drive complexity scoring
 
 ### Garnish Station Special Case
 - "Garnish" drives the whole bus - everything starts there
 - Not a physical station - maps to whatever cold pod the concept is assigned to
 - If no garnish step, routing fails (requires cooking group override)
 - For complexity: treat garnish as placeholder for "any cold pod"
 
 ### From/To vs Retrieve/Place
 - **From/To**: Material flow endpoints (HDR agnostic)
 - **Retrieve/Place**: Person-centric actions (derived for single-person execution)
 - Schema should capture from/to; retrieve/place is a derived view
 
 ## Key Decisions
 
 1. Map equipment/technique (HDR agnostic), derive locations from HDR config
 2. Default HDR config for complexity scoring
 3. Garnish = placeholder for cold pod (doesn't matter which one)
 4. From/To on components, not steps (steps can have multiple inputs)
 
 ---
 
 ## Full Transcript
 
 [Transcript content preserved for reference - see original meeting recording]
