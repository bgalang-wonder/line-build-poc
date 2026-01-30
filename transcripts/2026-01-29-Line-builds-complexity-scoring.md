# Meeting Transcript: Line builds complexity scoring and AI prototyping for Q1
**Date:** Jan 29, 2026

---

*[Meeting begins with casual conversation about schedules and technical setup]*

---

**Me:** Thanks everybody for coming. I wanted to provide an update on the line builds complexity score prototyping exploration that we prioritized for Q1. Shin and I have made a lot of progress and want to show that, but then also get some feedback on where this could potentially go.

Quick summary: the AI flow we talked about does work very well. Shin has used it extensively. We can go from any kind of notes—our legacy builds' conversational stream-of-consciousness ramblings about how the procedure should occur—and this agent will create very precise procedures. They're more like specifications over the current line builds we have.

We've explored expanding the data model as well, so we're able to capture a lot more details: material flow, HDR level specificity, and more. Since this is just a prototype, it's easier to get past some of the tech debt that's held us back in the past.

I want to check in about the exploration path. We also met with Evan and Charlie about KDS and the sequencing side exploration. I want to make sure we're aligned on whether we build this thing separately from the existing line builds or we try to incrementally grow the line builds we have today.

A recap of how I've structured the goal for Q1: build a prototype that works well, a data model that works well, and use that with Shin to regenerate our entire line build portfolio with robust complexity scores to assist Jen's work stream.

What we have built right now is an AI Agent that somebody non-technical can interact with. It has tools and rules that enforce that it actually creates a valid line build.

**Them:** Once you do it, what do you have? The structured line builds. Then you would decide: do you want to replace or do something different?

**Me:** Right. Rather than be held back by constraints of our operational data—especially because we can break things in production right now—we can build this separately. To be more specific to the complexity scoring initiatives or things like modeling how we automate things. That enriched line build still can be translated to the old line builds, but it's intentionally building it separately.

**Them:** Do we know what the structured line build will look like yet?

**Me:** Let me switch over to show you.

**Them:** The question is: does what you're building allow us to create a structured line build from the output?

**Me:** Yes. Also—

**Them:** That would be the goal.

**Me:** Shin, could I tap you to comment on this? When I'm working with Shin, we're uncovering things that were previously assumptions. He's able to add much more context that he had to gloss over because of the shortcomings of our current data model.

**Them:** I do think that the new structure can be distilled down to a current line build—there's enough information. There are some components missing that we could layer in, like batch limits. There still needs to be some mapping. That work is extra because it doesn't play into complexity, but it allows this structure to end up in the current line build format.

Brandon, correct me if I'm wrong: the goal is instead of continuing to make sure those two things are aligned, we can always go back and add that later. That slows down the ability to get the complexity figured out and build the tools Doug needs around complexity. But we're always thinking: how does this data structure compare to the current data structure? The initial goal should be to take this and map it to the current line builds. But is the ultimate goal to shift to structured line builds?

**Me:** Yes, the goal is to shift.

**Them:** I think because this has so much more granularity, this could be the structured line build, but it requires the KDS to change. They want to build attributes that can do some of these things, but until you figure that out, this is the source of truth.

**Me:** Right.

**Them:** I would generate these very structured ones and the idea is they would generate out what's needed for the KDS side of it. I think that's awesome.

**Me:** We can always distill down where this is the maximal truth, because the KDS line builds are ultimately a much more abbreviated version. We can cut down to what we have today. But if we were to cut over the KDS to feed into this, that would be a lot of work—not impossible, but more coordination.

**Them:** Is this going to be more readable? One of the things we talked about is how unruly line builds are to manage—every doneness of steak is its own line build. We've talked about collapsing line builds down with branches for steps or cooking appliances. Would this make that easier, or is it agnostic?

**Me:** I can comment on that and ask for your input too. Part of this is we're prototyping an AI experience where it's hard to click through all these things in our current interface because it's old and stapled together. You effectively just talk to the agent or give it your notes and it proactively finds the answers with you and applies them anywhere needed.

If we do it here, we already have an agent built in Cookbook. It would be feasible to upgrade our agent in Cookbook to use the same pattern. The learnings here could make it much faster to make that a reality in our production system.

**Them:** One thing to think about is Wonder Creates. You're going to have to instantaneously create a whole crapload of line builds. Someone's going to come in and say: I got this bowl with this much chicken, that combination, etc. I've created all these menus and I need to be able to publish and the line builds are published.

**Me:** Right.

**Them:** Keeping that in mind is super important. Are we mapping to current line build state or future line build state? There are three states: current, structured, and Wonder Create enabled.

Whatever we're doing here, it can be upstream of line builds, but you guys need to understand where line builds are going and make sure you're not building something that only works with the current state.

**Me:** Agreed. Alignment is important.

**Them:** The short answer is no, this does not have to connect to current line builds at all. What this has to do is power future structured line builds. And it's hard to say because we don't know what that is. But if this is the most granular, it should be a no-brainer that you could create the structured line builds off of that.

Over the next few weeks, just keep going on this. But at some point we need to take the output of this and say: how can I translate this out? What is it going to look like? What would a structured line build look like? Can I build it from this data?

At some point we have to ask: how do you take the structured line build to make it something that looks right on the KDS that someone can actually build something from?

**Me:** Right.

**Them:** To comment back: will this format be easier to view when talking about steaks and having multiple line builds? I think yes. We haven't built the customization function into this yet because we're still focusing on how to get a complexity score given a menu item. But because of the AI, as Brandon mentioned, it seems very easy to have the optionality built in on this step while everything else stays the same.

Yes, it's easier to create multiple versions of a line build. To take what we have now and align it to current line build—I still think it's possible. You'd have to make the mappings and say "this equals this," use another set of rules on the instructions to translate them to how Angela is working on line build text for the KDS screen.

All that work will be relevant when we go to the Wonder Create version of line builds. One thing I see challenging: if someone comes up with their own Wonder Create version of a menu item, we're stuck within the workflow of the HDR. You can't magically have a food item from this station appear on this station because that's where the rest of it is.

**Me:** Right.

**Them:** We're building those restraints in.

**Me:** Yes.

**Them:** Wonder Creates won't violate those restraints. Because we're taking into account HDR layouts and things like that, this has the potential to—if this becomes a line build generator, we're building all the baby steps to make it line up to current. Unless we completely change future KDS layout or structured layout, we're building the groundwork there.

Maybe because of that, keep going with this—get everything you need in here. But within the next month, at some point we need to start saying: great, I have this, how will this automatically create line builds for the game? We have to bring the KDS team and all that. We just have to make sure sooner rather than later we start that discussion. If you guys went down this path and we didn't check in until September, that's probably too late for Wonder Create—we'd be screwed.

It's probably a little too early in January, but maybe by February you guys are in a good place and have customizations and all these other things. Then we could start bringing the KDS team in and say: let's do a mock Wonder Create. I want to create this thing—what does it look like?

Or even before that: how would we take one of these and make a new line build for the KDS even before Wonder Creates? Is there an expectation for Wonder Create to just work off the speed lines right now, or is it every single—or is it just Infinite Kitchen?

**Me:** Infinite Kitchen only.

**Them:** Okay, so maybe we prioritize those. It's possible they decide they want it to work on the speed lines and non-Infinite Kitchen places, but then there would be a further restriction that you could only play within one or the other's speed lines. Whereas in a kitchen it combines all the ingredients for all of the four bowl concepts.

**Me:** Yes.

**Them:** What about the manual line? So Infinite Kitchen plus the off-the-finishing station—which is essentially all the ingredients that are in the speed lines today?

**Me:** Got it. Yes.

**Them:** That's good. So maybe that's the focus. Let's work on that. Cindy knows this well.

**Me:** Want to realign?

**Them:** Did that change? I know we're talking about it again now, but in your thought process of building it to where we are—

**Me:** I thought it was very important to make sure we were still wanting to do that. When I had spoken to Charlie and Evan, they were very much wanting to make sure we were accounting for how we would integrate to KDS, which at this stage I think would slow things down dramatically. If we can't iterate freely, knowing that we will translate it later.

I think within the next 30 days we can certainly validate that generation of a legacy line build. Within the next 30 days, it'd be very feasible for Shin and I to regenerate our whole portfolio of line builds, which would get you the complexity score. It would also validate that we can get to a legacy line build. And even what Doug was saying: we can sort of on the fly generate line builds that are compliant in a world where we would have to do it on the fly.

**Them:** Would this information be able to be pared down? This is everything we have—would we be able to say the HDR actually only wants to see this? Could they pick and choose what information they want to see?

**Me:** If we want to do any other derivations, we could. I'm thinking of how we go from this, which is super detailed, to "the line build only really needs one of these five fields" so we could upload it directly in Cookbook.

**Them:** Right.

**Me:** If we want other derivations, it would be very possible to do that if other views would be beneficial to give to other groups.

**Them:** Okay, it sounds like we're on the same page. The next steps over the next 30 days are clear. We can also connect with the Infinite Kitchen engineering folks to see what kind of data schema they need.

**Me:** Yeah. And if you're—I would keep going. Get customization and that stuff in. Then maybe check in. I don't think you guys are going to know more than anyone about Infinite Kitchen. If you're truly doing this at the most detailed level, everyone's going to want a less detailed version.

**Them:** Right.

**Me:** So I don't think that stops. Maybe it's: you guys tell us by the end of next month or a few weeks if you can get customizations in because those are the speed line ones. Then we check in, review some. Then you can take those, talk to the Infinite Kitchen team at that point.

**Me:** Yeah, we can wait till we validate. Jen, you had sent over the time trial data too. In our generation, we can showcase what that would look like extrapolated across our items. Since the time trial data wasn't for specific items—more like "this is broker data, this is pizza data"—we can extrapolate that so you can see it transpose onto the steps to review.

**Them:** Back to the complexity score: are we at a place where this is producing complexity scores?

**Me:** Not yet. It already is. On the right here—this is just a first iteration. I would want to work with Jen, Jenna, Shin to validate what things, but we've already been able to derive complexity score, even pulling in signals like station bounces and other things we couldn't really do before because we're modeling it at such a granular level now with configurations. So this already exists.

**Them:** Make sure we don't overcommit to that. What's the plan? Do we need those scores somewhere like in Cookbook, or is it more—

**Me:** Do you have any comments on that? I'm looking into talking with engineering about how we could get this minimally stood up without having to involve a full ENG team. If we get this deployed, it's much better than it being in a spreadsheet so it could be usable now, before we talk about any other resourcing.

**Them:** I think for the future and what we were talking about yesterday: the ability to use it with volume coming out of HDR, their real-time data, and being able to pull those and best incorporate it. I don't know where the best place is for it to live to do that, but it will need to live somewhere for us to be able to do that.

Is it someplace where Looker can pull from? I don't know what the answer is, but we do need a way to utilize it across different reports.

I feel like because this is on its own island in terms of data going into it, it's hard to make that match what's in Cookbook until it's part of Cookbook or until this is the way we generate line builds. There's always going to be this gap between: what version are we looking at here? What's in Cookbook? What information are we looking at at the HDR?

To get that to be automated—there's no point putting this score in Cookbook because it doesn't represent what's in Cookbook. And it could diverge. I can make this line build more detailed but we haven't published that to the field yet.

I think it might be useful to just have the scores assigned to the menu items with some naming convention so it is useful. But it would be hard—someone would have to know that score relates to this version of the complexity. In which case they would need to see this bar graph or the DAG chart.

**Me:** Q1, we can work out what a minimal process would look like and if we can get this minimally deployed.

**Them:** Brandon, is this going into Cookbook or are you getting Cookbook data in here?

**Me:** I almost feel like, so we're not as dependent on XM too, it may be beneficial to have this here but just ingesting Cookbook data.

**Them:** Right.

**Me:** It's more downstream of R&D anyway.

**Them:** That might be better. You have that validation: okay, the BOMs match, line build matches, here's the rubber stamp, use this. From that you can see all the other variations being studied.

**Me:** Right.

**Them:** We can maybe have a thing of: if you're starting from scratch, you say "give me the Cookbook data" and now I'm going to build everything in here. Then if something changes, flag it. Shin will have to decide: is it worth going back?

The hard part is this has so much more granularity that if I'm importing low-fidelity information, making it HD, then setting it back down—how do I make sure? Maybe to clarify: what data do we need and what could go out of this?

**Me:** Right.

**Them:** I mean, what's actually being delivered to the HDR? If that doesn't change, we're great. If it changes—essentially if the BOM changes—check this: does this need to change? The answer could be no, or yes. If yes, we just have to deal with it.

If there were two kinds of equipment being used for firing, or if we enabled holding versus all-minute firing, I would assume this would have to change in those scenarios too.

**Me:** You could do something similar to our nutrition review flow: if there's a deviation, it's flagged and you have to get it back in sync. That's a list you would just check.

**Them:** Okay.

**Me:** We could sort it out.

**Them:** Just to be clear, those things will take significant time to make sure it's all matching up. The question is: what's the priority? Do we want to generate a line build? Do we want it to sync with current data to say this DAG view is accurate?

What does the group think is most important/beneficial? This tight integration with Cookbook becomes critical when line builds are created from this.

**Me:** Right.

**Them:** Absolutely. But until then—the question between now and then is: are you doing every line build in here to get the complexity scores? That's up to you guys. I don't know how important it is to keep this up to date with BOM changes.

**Me:** Conceptualize this like a much better version of the spreadsheet you had. It's going to be out of sync, but it's a tool to use for analysis at this point in time. It'll be much easier to keep up to date because it's so much more ergonomic.

**Them:** I would definitely look at optimizing the speed line items so we could—my understanding is Mark is seeing the Wonder Create launch as a Big Apple product launch. I want to make sure this actually works when we have to put it into fruition.

**Me:** Right.

**Them:** Anybody else feel differently? The whole thing may be "man behind the curtain." I'm fine with the man behind the curtains, but we have to at least interface. By that point it's just going to be Wonder Create for the speed line. Folks—it's not "how do you make a brand Xeno?" It's "what order of buttons do you press on the Infinite Kitchen's machine?"

**Me:** Got it.

**Them:** Sorry guys, I have to jump. Thank you so much.

**Me:** Thanks for your time, everyone.

**Them:** Thanks.
