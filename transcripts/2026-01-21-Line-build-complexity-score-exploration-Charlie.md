# Meeting Transcript: Line build complexity score and data structure exploration with Charlie
**Date:** Jan 21, 2026

**Me:** How's my audio, by the way? Is it picking up background noise? All right. Cool. I see you had token limits last night.

**Them:** I did. I was wondering what happened.

**Me:** Were you worried you went over budget with Opus?

**Them:** I did—I thought you changed my setting. I totally burnt the budget of the department. Yes, I was just finishing up another meeting. It was awesome because I would just tell it what to change and it would do it. I also asked it to create more validation to avoid the problems I was seeing. It was just kind of working.

**Me:** Nice. Hey Charlie, thank you for the time and for the comprehensive feedback in the doc.

**Them:** No problem. Looks like we got plenty from that, and Timco also weighed in.

**Me:** Yeah, a lot of good stuff. There's some stuff we want to show you to get feedback on. Shon's been experimenting with a prototype because this is as much about exploring a new way of modeling as it is a new authoring experience that would enable more granular data. I want to make sure we're addressing the points you guys brought up—they're really important for what we actually do at the end of the day.

**Them:** Do you want to go through some of the high-level feedback from the team before we dive into the demo?

**Me:** I think we start here.

**Them:** I have a take on it, and I think Charlie probably has a different one that's somewhat synthesized for Matt and Timco. My biggest question: I'm 100% aligned that we need a better UX for line build creation and editing—that's a really important project. What I'm still lost on is why we need to change anything in the data structure. I'm not saying we don't have all the data we need, but adding attributes to the current data is very different than changing its structure entirely, which I don't think is necessary right now. Within that, I had questions about what the explicit problems are with the complexity score, and if that's actually a data structure gap or if we just need the right people to help pipeline the data correctly so it can be worked with without the manual Excel stuff. Those two points are connected. Separately, fully aligned on the UX, and I think you have interesting ideas for how to better create and edit line builds.

**Me:** I want to pass this to Shon, but I want to make some quick comments. I'm definitely not convinced we necessarily need to change the structure. Some of this is that in the UX, the data needs to be a certain way, so I've derived some of it to fashion the UX. There may be a way we can just get it from the existing data—that would be more ideal if we don't have to rebuild everything. I'm trying not to constrain the UX because the data we have available isn't in that format.

**Them:** We could always add middle layers. The UX shouldn't drive the data format—the application should. For prototyping it might be convenient to create a data format to develop UX, and that's fine. But in the end, if there's no necessary change in the data structure, we'd rather create a UX that works with the existing data structure rather than creating a new data structure and UX and then needing to change every product that consumes the current data structure.

**Me:** I think we're in agreement. There's also an additional point I'm considering: this was presented to me initially as having a separation in our recipe structure, where we have benchtop recipes and then execution that feeds into the KDS. They're separate, where benchtop doesn't have to deal with the same constraints. There's maybe a similar mental model I'm applying in my early exploration that could be coloring my approach, where we could define something that doesn't have to be constrained by current data modeling if we can translate between the two, which may lead to a better solution.

**Them:** In cases like that, a couple examples came up from the team—clamshell was a big struggle with this, and customizations are a consistent pain point. If those can be solved with simple attributes as part of the steps, maintaining our current data structure and just adding more attributes to it, I think that's a cleaner solution than changing the data structure. The key to a good data structure is that it's robust to new features. Our current one can handle more attributes to help facilitate that stuff better—clamshell is very stringy/hacky right now, and new attributes could have potentially solved that more elegantly.

**Me:** Yeah.

**Them:** Brandon also said he's trying to not be constrained. At the end of the day, I actually care less about this specification dictating the data structure. We can agree a DAG isn't important, but that's almost not even—if the DAG doesn't need to be represented in a graph database, that's more of an implementation detail. It's more about how we want to think about the data and operate on it from a higher level. The cookbook engineering team can decide how they want to represent the data and if it needs to diverge from the existing data structure. In my mind, the index should be: from our current data structure, what does it not do today that we want it to do? Do those requisite changes fit in our current structure? If no, then yes—we get what you're saying. I can see both sides: approaching it by forgetting about that thing and coming up with something new, then finding how to translate; or starting from this and moving towards something that meets these other things. It's not—

**Me:** Let me provide some context, then I want to throw this over to Shon. A lot of this is working out how we'd ideally want a complexity score. The point you and Timco brought up—that's a scenario where we backed into it because we needed it for the complexity score. Ultimately that would ideally be derived from the HDR portal or something where we can get routing information. We went ahead just to see what it would look like. This is something we were exploring as a material flow where Shon could easily see: is it in the cold side, the hot side, where are these components coming from—like fries from cold storage, packaging from here—a more visual way. There wasn't really a way to do that without mocking some data. I think that's probably not something we would set. The point Timco brought up was valid.

**Them:** There's so much variability between HDRs that introducing this granularity becomes difficult while keeping the structure general. When visualizing this, you'd need HDR selection to project the line build onto the configuration, probably just for visual purposes, because the line build itself shouldn't be HDR-specific.

**Me:** I also talked about having a global heuristic for something to use now, where in the future we expand into HDR-level specificity.

**Them:** So you have a template.

**Me:** For the sake of complexity.

**Them:** Using a template configuration to project it on—default that's stored in Portal. To back it up: there was a need to identify complexity of a dish so we could have actual conversations about new menu items coming in, how they compare to existing, what techniques are driving up scores, and staying away from them if possible. Also identifying where dishes are similar—data we don't currently have. With existing line builds, there's not enough data to store while still satisfying the KDS. We can't put extra stuff in just to have the information and later not show it. We were originally asked to use line builds to say how complicated something is, but I could go into a line build and add whatever operations asks me to add so they might do it correctly, but we still don't have the way we want them to do it correctly. One year from now, we look at line builds and the detail about having to flip the fish over disappeared, based on someone changing line build text. I saw that whole list of techniques you have too—that's what you're talking about. It's like, yeah, there's a hot step, but we don't know anything about what that hot step entails other than time in this appliance. It'd be nice to know what techniques they're applying for individual instructions in that hot step. That's kind of my point on attributes: if we have a list of possible selections for something—

**Me:** Yeah, I feel like we're all saying very similar things. Evan knows how hard some of this is to build cross-team. If we can plug it into the line build as it is today with no problem and just slap on a new UX, I'm totally cool with that. Even if we do that, we're still conceptually doing a separate thing now where we're defining data that's never meant to go into KDS, separate from execution data. It's important to be crisp and clear that we're doing that intentionally, versus adding fields that Charlie should or shouldn't add. Aligning on that first is more important.

**Them:** That makes sense. I still have some issue about trying to capture things like location in there. Technique is generalizable—ideally they're using the same technique at different locations, at different HDRs. But at different HDRs because of layouts, they might be required to do some of these things differently. I don't know why, but handing off over a shelf versus a conveyor belt is the only thing that comes to mind. I need to review the list of actions again, but there are things that don't make sense in this generalized structure. When creating a line build, that shelf only exists on Expo—that field only exists on Expo. I keep all that in mind as much as possible when doing complexity stuff, because I'm still stuck remembering as much as I can. I had to put it into Excel previously to make sure it counts everything correctly. The goal was: how do I create a complexity score as consistently and easily as possible, so it's not just me doing it—anyone and any chef/creator can just say "this is what I want to do" and it creates a structure with all the relationships that makes sense from an end-user standpoint. From there, don't recreate the line build, but create it in a way that—

**Me:** Yeah. This was part of what I was messaging you before the meeting: I think that's probably the right way to do it. We do need some HDR-specific data or an approximation for the complexity score, but if we do this right, we'd plug into that data and it would be another layer on top of the line build or this "truth layer" we're talking about.

**Them:** Right. We already have that. It gets tricky with how to do it because we probably need more layout data than we currently have. Even today, line builds are supposed to be general. We get the layout from the HDR and marry the two to determine routing. Maybe there's a way to enhance the quality of layout data, and with this enhanced structure, when we marry them we can derive more granular actions for complexity. I don't think they belong in the entity representing the preparation flow because it makes it inherently not generalizable to include details specific to how it works at a given HDR. I agree with the overarching theme: high complexity view that captures as much data as we want, distilled into an instruction view for the chef at a higher level, then distilled again into what we show on the sticky dupe. For the proposal to work, there's detail missing about how the complexity score will be calculated. We need to provide more specific requirements about what we need for the KDS to make sure nothing's missed, and feel confident it will tie together properly before we embark. For actual implementation, we may quickly find we don't need to change the data structure very much—

**Me:** Let me schedule a follow-up. I have to run.

**Them:** It's okay.

**Me:** This is great. I agree with everything you said, Charlie. I'll schedule.

**Them:** We need to provide our list of requirements and give Brandon, Shon, and everybody a chance to see how these fit into the proposal. Shon, you have a lot of them—whenever you need to customize two separate versions of the same line build, that's something the current system doesn't let you do seamlessly that we need to fix. That list is what we should be fixing in the data structure, which I'd like to see documented. That list becomes a change log for the data structure, which is one part of the project separate from the creation/editing flow. You made a lot of progress and the UX looks great.

**Me:** I'm going to drop. You guys can continue.

**Them:** What ce—
