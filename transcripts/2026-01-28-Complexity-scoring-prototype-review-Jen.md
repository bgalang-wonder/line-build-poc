# Meeting Transcript: Complexity scoring prototype review with Jen
**Date:** Jan 28, 2026

---

**Me:** We wanted to get feedback on what we've been experimenting with and better understand some of the other work happening with complexity scoring. It seemed best to get on the same page before rounding this update to Doug.

Let me share my screen. We've been building a prototype that you can talk with like ChatGPT, but it can create line builds that follow certain rules. It makes it easy to translate general culinary speak into structured line builds, or convert old legacy line builds into something more precise.

**Them:** It's producing a new line build, not the line build book. The legacy line build we're talking about is the complexity spreadsheet. So it's taking the complexity spreadsheet and turning it into this flow.

**Me:** This is more of a process specification. It captures all the clarity from the previous spreadsheet while teasing out where transfers are happening.

**Them:** These are all the items listed in that Excel, now dispersed out.

**Me:** I'll describe it—it's all of the previous clarity plus pinpointing where transfers occur. There's a multilayer configuration, so we can derive where pod transfers are happening. Right now it's set up with a single HDR configuration, but we could plug in multiple HDRs to see across the portfolio.

It shows when inter-station transfers happen, within-station movements from work surface to equipment, and pod changes. We have a clear set of rules being applied—nothing is hidden. You can easily add a new rule and see how it reflects across the portfolio.

From this, we've prototyped what a complexity score could look like—ranking complexity across test items. Shin has about 27 here.

**Them:** How are we exceeding 100?

**Me:** This is an absolute score, not out of 100. I can normalize to 100. We've assigned weights to different things.

**Them:** The old complexity score will still drive scoring, but we haven't gone through the whole portfolio to plug it in. We're still focusing on the data we looked at to set the scoring, then we can dump everything else in.

**Me:** Essentially. I'll also show an interface where you can toggle how the weights are across steps in real time. Remember, you commented that we had all the things from the original complexity approach, but now with more data, it's easier to add in harder things to capture.

**Them:** Because of how we scored previously, we had to take every location and assign it a weight, then represent transfers as locations. Now we're systematically exploding the previous complexity timeline into the line build, so we can pinpoint more things happening and assign weights to them.

For example, when we previously said a transfer from a turbo station to a fryer should get a weight, now we can actually say those weights are this specific value. We can adjust scoring based on what we're seeing in real life. It's easier to pinpoint where things happen because the whole thing is chained out.

Merge points—when you have two things coming together—were previously just represented with the word "place." Now we can pinpoint: if I'm using a place to combine ingredients, it's this complexity. If I'm just putting it on my workstation, it doesn't have the same complexity.

We can use these things or choose not to. Initially, whatever it recommends, we'll evaluate it, but we have our old scoring to lay on top. We can tweak what we're finding wrong. Because the AI has enough data points to check, we can ask: "This one is high, this case is too high compared to this—can you make suggestions?" We can evaluate those with the defined touch points and apply it to the whole portfolio.

**Me:** One more thing—what was previously just tracking discrete steps, we can now track material flow separate from step dependencies. That's how we model station transfers or merge points, because we can model when something combines with a sub-assembly as it moves through the kitchen. Previously our line builds couldn't capture that, so we hacked it together.

**Them:** This is awesome how they're coming together and merging through.

**Me:** Where it gets tricky...

**Them:** If we could get this to Michael, he could literally search to see what to concentrate on, what components need more prep.

**Me:** We need quantity data.

**Them:** Which items go in the IK, which in the gantry, where things are cross-utilizing—all that.

**Me:** Also, this can be queryable.

**Them:** As far as the time it takes to complete these steps...

**Me:** We have time study data for the next phase.

**Them:** I'm meeting with Mariah tomorrow to understand the data being collected from the sequencer for step completion times. Once I understand that, we need to come together to determine the best representation of time to use. Do we use time study as the basis, and sequencer data to identify operational challenges?

The theoretical times identify issues, while real-life times show during service. If theoreticals are static but sequencer data changes in real life, can that report back into the system dynamically to update? Not for right now, but thinking about where we can go.

If you click on station timeline...

**Me:** There we're seeing...

**Them:** This mirrors the KDS screens. Anything in red is an error to clear. This view—like water bath—if you look at this one, it has water bath as the first box. Cook time plus focus time can be represented there.

Garnish steps should collapse into one. Whatever we're seeing as cold pod duration can be represented in this block. Depending on how they're capturing data, there's a place to plug it back into this.

On the work order screen, every item has arbitrarily set five seconds. We haven't been this specific about how long things take, but if we can give enough pattern data—hey, the quesadilla is the same for these items, cook times differ here—AI might be able to backfill some of the times.

**Me:** We could track separately what we explicitly capture versus what we're inferring from step similarities. The agent could explain why it pulled certain data, so we can replace it later when we get explicit time trial data.

**Them:** I have the time trial data now. I can send it when you're ready. It's extremely detailed, so you can find patterns—every time they do a step using tongs, use the same time across the board instead of going menu item by menu item. Group by technique and types.

For the real-time data we're collecting, I'm concerned about the cold pod data because during peak times they can work on five items, leaving something hanging while working through others. That can skew data. But comparing those and using them to identify operational challenges—when certain dishes are made together, things slow down—would be valuable.

**Me:** Whatever is possible.

**Them:** When would we have the capability to pull volume during peak time and see what the complexity score was for that period? To compare peaks at different HDRs and understand different ordering behaviors. We had talked about adding complexity scores for a given 15-minute period.

**Me:** One of them was zero.

**Them:** I mean, take the peak time you're looking at—say Westfield from 6-7pm. We have data on everything sold, we know the menu items, and those menu items have complexity scores. Just add them together and give me that complexity score.

**Me:** So you're describing—assuming we have robust complexity scores—creating an aggregate of complexity throughput.

**Them:** Yes, exactly. Per station ideally. We're talking about overlaying complexity into a real HDRS portal.

**Me:** We have it configured for 14th Street, modeled as an HDR, but we could plug it into any HDR using HDR portal data. With throughput compared against configuration, we could output complexity scores.

**Them:** That would account for when we combine fryer, water bath, microwave on one station versus separate—the transfers affect complexity. We can adjust for location-specific layouts and apply that. So when comparing locations, we're using that location's specific layout for a more accurate complexity score.

Right now it only really affects microwave/fryer being separate from water bath, but it would allow us to not redo everything for different layouts. If we have a sandwich station, we define that pod, what food goes there, and it produces a complexity score for that station layout. The builder stays the same.

**Me:** We just derive an HDR-specific score. Jen, you mentioned you could get us the time study data.

**Them:** I'll send it now.

**Me:** It'll be easy to have the agent transpose that into the schema to see how it reflects on captured items.

**Them:** Perfect. One more thing—can we look at correlation between complexity scores and guest feedback?

**Me:** We just need the data.

**Them:** This isn't for Q1, just a path forward. It came up in our QBR with Tony yesterday.

**Me:** Very feasible—we'd have per-item, per-HDR specific complexity scores. Just compare generated values against review data for a given period.

**Them:** What we can't do yet is the scheduled version of complexity scoring. If an item has a process change, we need to time reviews to that score versus the old line build. That's cookbook schedule tied to this type. Maybe higher priority than guest feedback. We'll create versions, but tracking when they're live versus not requires additional data tracking.

**Me:** Some of that data exists in BigQuery. When Cookbook cuts over, give it to the agent to set dates appropriately. With this setup properly, it's more feasible than before.

**Them:** And seeing how adding whole new restaurants changes overall complexity at locations. When doing that, look at busiest urban, busiest suburban HDRs. If we're pumping this in with an incidence rate of X for ordering, what does that do to the complexity score?

There's so much more to do. This is great—a great starting point. I'm not taking away from what you've done; this is amazing. If it didn't look so good, I wouldn't already be jumping into these other ideas.

**Me:** We've talked about some of these, so it's validating that you'd find them helpful. The throughput view is something I could mock up in a week or two.

**Them:** That would be awesome. Especially for throughput to understand why this site can do it but that one can't. It may show us something we didn't see before.

**Me:** Do you have throughput or order data for an HDR? We could spin up something quickly to show complexity throughput for items at this HDR versus another.

**Them:** Through Looker I can pull all items made during time periods. From that, we just need to drop in the complexity score for each menu item and total it. Very simplistic—I order Eden citrus salad with score 32.7 and a burrito at 75, that's 107.8 total complexity points for that time period.

We'd want to split by pod—hot pod total, cold pod total—aggregate by pod and area (hot, cold, speed, pizza), and look at HDR total for the time period.

To do that most accurately, we'd need to pull from the portal: concept assignments and cooking groups. Need more cooking group data from Cookbook applied to menu items. Can Looker witness that? It can pull sales data and tell you what was done in hot pod versus cold pod, with different steps broken down.

**Me:** We could do it. This would be hard in production, but at the prototype stage, it's easy to validate. If you want to productionize it, we need strict pipeline and rules. But this could take just a few days.

**Them:** Maybe this feeds into Looker, pulling data from data tables here. The app doesn't have to do all the work. Running this in Looker would be amazing.

**Me:** I'll prep these as talking points for tomorrow.

**Them:** I know we're at time, but real quick—I talked with Jason and Evan this week about cook time and order-to-eat time. We decided it's not possible to make blanket statements about how times would change in 2026. But they mentioned building a simulator on their side to take in sequencing information, labor data, to forecast order-to-eat times. There's work being done on an HDR simulator to make changes and see theoretical impact without sacrificing guest experiences. Six months to a year out. I don't see how you can do that without some of the precision here.

**Me:** I think we can probably get there faster.

**Them:** The data is done. Pull it, make your own attributes to figure it out.

**Me:** Data's done and AI changes it instantly. All scenario analysis is right there. We rebuilt this thing 10 times in a week—the iteration speed is crazy.

**Them:** That's insane. When we have multiple different builds, we can ask: here's how we think we should do it, can you tell us if this is the best way? And it can give different line build suggestions.

**Me:** I can prototype that. That's where it gets fun. The agent can plan out and attempt 50 different configurations with access to constraints, validations, and scores. It can give you the top three that pass all constraints, or tell you none worked.

**Them:** Can this eventually track real-time feedback? If we sent three variations to three different HDRs, could it track which is better? Whether it's line builds or workflow variations—how items move through the HDR. Instead of manual pulls in Looker, can it work both ways?

**Me:** If we had a feedback loop indicating how good or bad a line build is, and that data was somewhere retrievable, we could derive scores on a per-line-build, per-HDR basis. It would require time study data from people to provide that.

**Them:** We can chunk any of that. If we want to focus on the turbo station, extract all turbo steps at a location and evaluate in that small bucket. It can say this complexity feels right, this is underreported. Change the scoring quickly with this model.

**Me:** Easy to fix one time and have it fixed everywhere automatically. Best guess where we're making inferences.

**Them:** We can validate ones that are good, and it can look at one-off inputs and make generalizations for us. It could score it for us.

**Me:** I want to be respectful of your time.

**Them:** Thank you, I appreciate it. I'm excited.

**Me:** Thanks, Jen.
