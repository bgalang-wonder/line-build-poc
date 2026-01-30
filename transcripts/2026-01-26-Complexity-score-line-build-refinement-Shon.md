# Meeting Transcript: Complexity score line build refinement with Shon
**Date:** Jan 26, 2026

**Them:** Are we allowed to use teams?

**Me:** Use it till. Not ergonomic anymore, I guess.

**Them:** It's funny. Every reader today, always someone hopping onto the teams meeting first.

**Me:** It's just a shit show.

**Them:** It is.

**Me:** Adding some of these validations looks directionally correct, but there are some small nuances in how the agent is creating the line builds because the rules aren't perfectly tight right now.

**Them:** That's what I'm worried about. I'm happy to go through them and painstakingly adjust what I see, talk to it, ask why it did that, and try to give it better validations. I just want to make sure it makes it across. Looking at the Details tab, some things are not important for defining relationships, but it's easier for me to look at and be like, this is what I said previously, so this should translate to this now.

**Me:** Yeah.

**Them:** I always go into details and adjust it. Last time I asked what's in your JSON, what are all the possible values, and how many are showing in the details panel. I even recommended seeing these two, said yes, and it showed them. When I opened it this time, it was back to the way it was. I can adjust it again, but it makes me worry about everything else making it across.

**Me:** This most recent batch, I refactored a lot because we talked about defaulting to the default HDR. Now it's deriving values assigned in this mock HDR, so it will look different. This is where we review it with you. The things you're seeing as missing, we can fix. The data is plugged in correctly now and flowing the right way. Before we went down different directions, now it's properly pulling data. When we sit it in the right place, it'll pipe through properly.

**Them:** Even Barbie, for example, which looked good on the last iteration—the material flow is off. It's only pulling in two things on the very first step.

**Me:** This is generated directly from the old line build in the spreadsheet without your enrichment. Some of it will be erroneous because we just pointed out rules we didn't have.

**Them:** For example? I'm happy to walk through it, but I want to make sure things still work. Looking at instructions from dry rail now—which is fine—but if I'm assuming the logic is right, it looks like it doesn't know dry rail lives on the cold side, and therefore it's not drawing a material flow for this.

**Me:** That might be a product config issue in the HDR.

**Them:** This one refresh. Should I just keep going? Should I do it anyways, or should we figure out some of this stuff first?

**Me:** Let me take notes. I have Claude open working through things. You're saying dry rail...

**Them:** No, sorry—on the cold side. This is the old one. Here, foil sheet—it knows it's coming from the dry rail, so the material flow shows accurately. In the new one, it's lumped into the description. I can look and say "place full sheet from dry rail"—I don't know what neighbor that is, but we can find it over here. S7—it looks like it's missing some key points that should at least be in the original scorecard. Also missing technique, tool quantity. Maybe they're in the JSON file and just not being displayed.

**Me:** That might be part of it. Can you show me the material flow?

**Them:** If I go...

**Me:** Can you go up to the upper left to show me where it is? What's the station it's coming from?

**Them:** It's only first step. Nothing else.

**Me:** What's coming from...

**Them:** Is going...

**Me:** It says it's coming from a press station. It did not connect. It's not putting it at the garnish station, it's putting it at the press station here.

**Them:** That's because it doesn't know the press is on the cold side. It should if it pulled in from the portal.

**Me:** Let me see. You were asking if there's a press station.

**Them:** Yes. There's a press station. Press equal... In real life or in the tape? What do we mean?

**Me:** In the table. You had told me there was a press at the garnish.

**Them:** Yeah.

**Me:** That's confusing. Did we say in our spreadsheet that there's a press station, but there's actually also a press at the garnish? When it tried to assign, it should put this in the press, but it should have known because of the edge case.

**Them:** Maybe. I think we did.

**Me:** We can fix it.

**Them:** How did I send that to you? I gave you scenarios that could still be true during the situation. That one's maybe far-fetched, but I gave you scenarios where the current ADS logic could support a press station, so I left it even though we don't use a press station. Does that make sense?

**Me:** I see.

**Them:** The press station is always incorporated into the garnish station—press equipment. Therefore, the substation of the press, meaning all the pre-cooked/post-cooked steps surrounding the press equipment, would then live on the garnish station.

**Me:** We should remove the press station as an option then.

**Them:** We've removed press station and toast.

**Me:** We can have them there, but they would need additional qualifications so the agent understands whether to use them. Logically, if it needs a press, it would go to the press station unless we provide details.

**Them:** I'm trying to be flexible so all the current menus would work. Press and toast—we don't need. But press and toast I do need on the clamshell station. Let me find...

**Me:** On the quantity point—would quantity be required in every step?

**Them:** No. It's always assumed one. It is always one unless it's defined. It's a multiplier for what we're doing. Quantity is always one here—everything is filtered to one. Every once in a while, like I had to do two shakes or three shakes, and the only way to capture complexity was shake has a 0.5 value, two shakes equals 1.

**Me:** Okay.

**Them:** The quantity was only applying to the technique. It wouldn't say I have to go to the dry rail twice—it's I have to do the shake twice.

**Me:** I see. Interesting.

**Them:** It's a little skewed because sometimes if I need to grab two pouches, it's not saying go to the cold rail twice, but it would be "place twice." It still works.

**Me:** Yeah.

**Them:** That was the thought process.

**Me:** I'm checking how the schema is handling quantity.

**Them:** Use and change. Every time there's a technique for everything we're doing, the quantity is just the multiplier on that technique. If that needs to be explicit...

**Me:** Maybe we can have a technique quantity field. I was thinking of quantity as bill of materials—how many quantity items—but that's wrong. It's a modifier on the technique.

**Them:** It works both ways. When you have to do something twice, if I need to grab something or place a pouch twice, it infers you're doing the thing two times. Or if I'm doing a 10-point drizzle, it's a quantifier for the technique. In the future, if we're tying things directly to bottom lines, there could be item usage per line—probably necessary from an inventory perspective.

**Me:** I'm adjusting the quantity and hardening that.

**Them:** We can get rid of press station and toaster station. Do you think it will get confused because the clamshell has a toaster and the garnish has a toaster? Will it know which one to assign?

**Me:** Sorry, can you repeat that? You're saying there's shared equipment at more than one station?

**Them:** Yes, there are repeats. The hot box can live at any hot station. The station is named mostly after the cooking technique. The hot box comes into play if you're hot holding something. The clamshell is a hybrid pod with extra equipment. The speed line is a hybrid pod with all this extra equipment.

**Me:** It can retrieve and see where it can find equipment at what station. If we provide decision-making criteria on when to use one or the other, or infer based on what it gets, or if we explicitly say one, then it assumes it's that one.

**Them:** That would trigger a bounce—it would flag to go fix it. The information is mostly in the complexity mind build or complexity score spreadsheet. Station has an equipment line. Frier station universe on...

**Me:** Just a little bit.

**Them:** He's learning. Don't put thoughts together.

**Me:** He's excited. He wants the salt.

**Them:** He's like, there's a hummingbird in there. I can work through it as long as location, tool, technique, and quantity all live in JSON, whether they're explicitly listed in the side panel. Do you think some of that stuff was not explicitly told to save the data?

**Me:** There's been a lot of adjustment to the schema. I'll update this so everything in the JSON is shown in the UI. Even if we don't want to hide something in the future, let's shove it in so we can review it.

**Them:** That would make the review process easier.

**Me:** I can add a unit test that always validates anytime we push a change.

**Them:** I'll wait for that version. Then we can go back and forth without actually running the process.

**Me:** Once we get this to specification, it will generate and be totally fine. Some things are just a little off. I just fixed the quality. You were saying remove...

**Them:** Explicitly tell it to remove the toaster station and the press.

**Me:** Okay. There was one about the dry rail.

**Them:** That was in the new version that was just sent. You were expecting it to be a garnish.

**Them:** Everything below in the blue section should have its own list of material origination points. When I look, there's nothing there. The location from where it's pulling is in the description or text box. It got confused.

**Me:** Does it let you click on there?

**Them:** It doesn't do much. It does this, then I have to go over here and find it.

**Me:** Maybe we can change that.

**Them:** Where it's saying... This is the wrong one. No foil. That kind of works. This is the rod foil. It's out of order. Repeated. It's doing weird stuff—pulling the tortilla down and cooking it, putting it on the foil, combining it with brisket, then crypt O TS1 press, reflect from Gyrail. The order these steps are showing is weird.

**Me:** What would you expect?

**Them:** Comparing to this—the tortilla and pearl get combined. This is the Barbacoa Quesadilla versus taco. That's why. Let me back up. I thought they were the same. I might want to look at the quesadilla first. I would expect this to happen, this to be pressed. You have three lanes conversion. Actually, you're heating the press, then taking—I can't remember if we do the foil sheet to cook the press, so this might have to come over here. After you cook it, you're taking three tortillas from the press and placing them on your work surface. Your brisket is combining with this to make a taco. There are two lanes—one where brisket is being handled, one where tortilla is being handled.

**Me:** I see. It's functionally the same, but you conceptualize it as merging later versus merging at the start. It's saying you merge then prep sequentially, versus prepping in parallel until the last second where you merge.

**Them:** If I never open this brisket, what actually happened is you take your hot tortilla and your pouch and put both on top of foil. If AI gave me line build pictures, it would be a weird picture of foil with three tortillas and a patch of brisket on top. Then it would say "place three cooked tortillas from press," which is this step down here. This connection should be here. Now you opened it, but how do you have a pouch sitting on a tortilla and now you're opening it? You could use tortillas as a plate to carry a pouch, but...

**Me:** We can solve this simply with a prompt—only merge when that sub-assembly is going to be active, versus merging immediately.

**Them:** I can feed it that information as I'm going through. If I see it happening, I can say don't place a pouch until you open it, or don't place contents of a pouch, don't have an assembly step on a pouch until the pouch has been opened. That's a safe rule.

**Me:** That kind of procedural thing—once it knows, it adds to the cloud and just does it.

**Them:** This makes...

**Me:** You see this transfer? This is new. Click the transfers toggle at the top next to critical path. It shows substation, in-station, between-station, and between-pod transfers.

**Them:** Substation to... between pods. How does it distinguish between pod station?

**Me:** It references the HDR configuration, checking the fake pod station equipment setup to derive when transfers happen. Do you have data on what the hardest HDR is? I have it as mock data now, but if we could replace it with actual data, these would show up at the right place.

**Them:** I thought you were going to use the default.

**Me:** I don't know what the default is.

**Them:** You couldn't find default as a data point?

**Me:** I don't know if I search in BigQuery for "default," is that a thing?

**Them:** It's got to be somewhere because default site layouts are here. When they create a new location, they pull in default settings. Under Portal HDR list, there's a list of five HDRs considered defaults.

**Me:** I don't know how this connects into backend data. Even this is D1 through D5, but these describe full HDRs. I need to look up actual HDR data. I just need to know one HDR that represents default.

**Them:** It's pulling in a JSON type thing. Default site layout—I can't make another one. If I go to a location, pod settings, edit, I can apply default site layout. That button overwrites what's there with default settings.

**Me:** I can maybe find it.

**Them:** Not important.

**Me:** Let me see if Claude code can find D1 through 5. Is there a D-numbered layout you'd want me to use?

**Them:** If you can't get anything, use Westfield for D5—it's the most complicated. D3 is our bread and butter, the one we're opening hundreds of.

**Me:** That'd be great.

**Them:** This is complicated because some locations have two screens combined, some split them up. This is in DC, has water bath, has its own fryer. Pretty standard. Assignments don't matter because it's essentially... You can use this first one—14th Street Northwest. Worst case as your D3. If you want one more complicated with super pod A and B, this only has three types of pods: one super pod, one hybrid. These are your speed lines with all that equipment listed—a garnish station with turbo, press, rice cooker, water bath. D is the pizza station with water bath.

**Me:** Pizza station has a water bath.

**Them:** Station Pizza has equipment. Westfield has more pods. I don't know if that will confuse it.

**Me:** Confused by what?

**Them:** The D5. I'd use D3 because it only has one super pod, one type of each pod. A and B are mirrors—they have the same type of equipment but not necessarily. Let's just do D3.

**Me:** We can just do D3 to start. We could add both—generate against D3 and D5. It's just derived data. We could have a toggle.

**Them:** I worry because we didn't give explicit rules to say don't go across cold pods. It doesn't matter for complexity, but in the future, it might think it could take something from Cold Pod A's turbo and send it to Cold Pod B, which isn't connected. That's an easy fix. For D3, pretend you're only using one super pod until you have restaurant-like routing assignments.

**Me:** We could easily fix this. If we make this into a full app, we could have D-number level custom instructions—layer on rules that only apply in certain scenarios, automatically depending on what you're editing.

**Them:** That's interesting. We're working with a baseline build equivalent to an all-in cookbook line build data. We've talked about what if you swapped equipment at this point. We haven't gotten there yet, but once it's in app format, you could tell the system what you're changing while changing it, and it could track the two.

**Me:** There's a lot that opens up when you don't have to track stuff. Some things require another step—we can replace this step with these two steps or insert differently.

**Them:** You could have attributes—I'm doing this because of this—and it could remember that.

**Me:** Exactly.

**Them:** I touched base with Rich. He wants to make sure you guys get your complexity score. He doesn't care about...

**Them:** Yes.

**Me:** I'm more wanting to make sure we account for it, but it's more about making sure you guys get a separate tool. I set up a meeting Thursday with Doug and Jen.

**Them:** I saw that.

**Me:** Just to be clear so we can go into this and not worry. It's hard enough as it is.

**Them:** On another call today, they asked for cook times so they can project how order-to-eat times would change in 2026 based on menus we're working on.

**Me:** Yeah.

**Them:** This doesn't make sense. I set up a meeting—I can give you cook times, but we can shorten cook time and make it harder to put together. One minute of cooking, three minutes of prep. Giving you these numbers doesn't help you get to order-to-eat. Evan mentioned they're working on a better simulation tool that would take this work, Brian Niese's equipment throughput work, sequencing logic, and the labor model to figure out how long things take to finish an HDR. It sounds like you need our complexity numbers because we'll have each step.

**Me:** Do they have enough data to do that?

**Them:** No. He said six months to a year before they have something. That's their dream state. You need better data than line builds. Throughput is based on your line build. If line builds aren't great, you're artificially limiting how fast dishes can go.

**Me:** You don't have an accurate picture of what's going on.

**Them:** I understand why you wouldn't want that—you can't process that much information. Once you have it, the onus is on them to make it better. We've always had to modify our process for the system so it doesn't break. That limits what we're allowed to do. This gives it to you in a way where you have everything, can look at it how you want, and improve your system without coming back every time asking how to change data.

**Me:** When I was getting this prioritized with Doug, he's frustrated with how locked together everything is. He liked the idea of building this completely separate from line builds. Even if it may... I don't think it would be harder. With AI, we can make it work. Having it separate is better given different needs—we need to stop shoving everything into a single data model.

**Them:** Absolutely.

**Me:** We tweaked the data model five times just in this conversation. That would never happen if it was in line builds—we'd have to check everything with Charlie.

**Them:** This is interesting to think about. If it was "let's tweak line builds to do this," you'd have to rethink everything. Really, we just want to be able to tell it what we're doing, not think like a line build.

**Me:** I literally just adjusted those things we talked about earlier, changed the rules, and it's churning through making adjustments—the ordering thing you asked for, it's doing that.

**Them:** I'm not worried because I can fix it on my end. One thing confusing was step names and step times. Once I told it to change the details panel, it fixed it. In the work order view, if I click something, there's an ID like S9 correlating with S9. But with different tasks, you'll have an S1 with step 21 because it renames each branch of the timeline to restart from one.

**Me:** Those should either be completely separate or always locked and aligned. Right now they're two separate IDs that can diverge.

**Them:** This is good. I'd probably change the naming convention to "choose your salsa track one," "default track step 10." However it wants. I can adjust that.

**Me:** I'll fix that now. I'd rather have it enforced in code.

**Them:** Once I have the file, I'll take a look. Can we set up time tomorrow? Before I get going, I want to relook and confirm this is good, this is everything, so we're not missing one giant misunderstanding.

**Me:** I'll get this adjusted and give it to you. You can have Claude generate a few at a time instead of regenerating the whole thing when it's wrong. Generate one or two, review it, then extrapolate if it looks good. I'm telling Claude to generate following the rules.

**Them:** I'm not worried about what it's generating—I'm worried about the general layout, everything in the right field. Before I fire off and go, I want to make sure there's not one huge misunderstanding. Like the quantity—if it's in the wrong place, wrong definition, and I do something assuming it means this when it means something else, it's a waste of time.

**Me:** I got you. I'll get it adjusted and send it to you in a little bit.

**Them:** I'll look at your schedule and try to set 30 minutes to confirm everything looks good or discuss anything I want to verify tomorrow.

**Me:** Perfect.

**Them:** All right. Awesome.

**Me:** Good stuff. Thanks, Shon. I'll see you.

**Them:** That might.
