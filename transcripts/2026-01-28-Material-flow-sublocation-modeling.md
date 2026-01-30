# Meeting Transcript: Material flow and sublocation modeling for line build complexity scoring
**Date:** Jan 28, 2026

**Them:** The biggest problem is the way we use location. In the spreadsheet, it was almost always the "from"—where I'm getting this thing from. It's like the branch reaching out of the workflow: "let me grab this thing." Until the cooking step, where it became "let me put it in there" and take it out later.

**Me:** You're saying this is less about rules and more about the agent not interpreting things properly? Like when we feed the CSVs in, it assumes location means one thing but should make a different assumption.

**Them:** Right. It sounds like the agent assumes location is a substation. But the substation is where the thing is happening—the location is what's coming to it. Let me open an example.

**Me:** Yeah.

**Them:** Something as simple as a salad. If you look at the workflow: prepping, grouping as cold side station, garnish tool hand—this is where I'm getting the kit. Phase assembly sublocation is cold storage because I said this kit is coming from cold storage. But does sublocation apply to the component or where I'm standing?

**Me:** Oh.

**Them:** In this situation, I feel like sublocations should be "work surface."

**Me:** Work surface. Yeah.

**Them:** And it assigned it correctly here. But going down the chain: "place 32 ounce bowl" is another node, a start of the branch. The packaging is coming to the workstation.

**Me:** Would you think of this as tributary language? When material flows from cold storage and joins the main branch, like a river tributary.

**Them:** Yeah.

**Me:** Those tributaries would start with a derived transfer step: from location is cold storage, to is work surface. Then the prep step happens at the work surface. Does that capture what you're describing?

**Them:** Yes. The only time you're moving off the work surface is going into equipment or transferring to another station.

**Me:** Yeah.

**Them:** I'm wondering if there's something fundamentally missing in defining this. Looking back at a version from two iterations ago where I did very little correction—it was really good. But sublocations were blank across the board. Something with prescriptively defining sublocation instead of letting it figure things out made everything linear and material flow nonexistent. Whereas in this version, there's actual workflow.

**Me:** Part of the issue is we're modeling two separate things: steps and material flow. Steps have material flow with from/to, but they don't really map. Some should be derived. A transfer step doesn't really have a sublocation—it only has from and to. You're not executing a transfer step at any particular place.

**Them:** Yeah.

**Me:** Sublocation isn't required for transfer steps. It's required for anything where you're actually doing something.

**Them:** Wait—what is a sublocation?

**Me:** It's a location within a station: work surface, equipment, shelf, cold storage, cold rail, hot rail.

**Them:** I think those are all valid. To me, sublocation is your reference point. You could be on the cold rail transferring to the work surface—that's a passing function. If you're on the work surface getting from the cold rail, that's a grab.

**Me:** Okay. Remember we talked about not having reference points? We should model the movement of food absent of people, so you could technically have multiple people.

**Them:** I'm not talking about the person—I'm talking about the command. Whether I'm a person or the food itself, relative to me I'm either getting something or passing something off. The commands make sense from the basis of "where am I"—the sublocation.

**Me:** That does imply a person, though. You're saying "in reference to you standing at a station." That encodes this as one person doing the line build.

**Them:** No—you could change the sublocation and change the actions. Whether it's one person or two, the step is relative to the place I'm at.

**Me:** Yeah. We started with reference points, then moved to modeling the path of food moving absent of where somebody stands. Regardless of one person or two people at different substations, you could figure out what their from/to would be as long as you know the food's path. I think we haven't fully cut over to that.

**Them:** Sure. If we're just describing the movement of the food, and from/to is the journey—"this piece of food is going from X to the work surface"—that makes sense. Check. But then what's the sublocation?

**Me:** I think we need to remove from/to on prep steps. From/to is only about material flow.

**Them:** But "place 32 ounce bowl" describes the motion of the bowl.

**Me:** That would be a transfer step, then. We've already described essentially transferring from first location to second—transfer is the place.

**Them:** Yeah.

**Me:** Yeah.

**Them:** The first step is the from, so the sublocation of that is nonexistent.

**Me:** Right. This step shouldn't exist, or should exist in a derived view. The prep/place step has an equivalent retrieve step. If we're modeling food movement, we say it goes from here to there—agnostic of a person retrieving/placing. You can break down that transfer step into retrieve and place parts in a derived view. But right now we're still modeling the placement step even though we're trying to derive transfers.

**Them:** What should it be? What values live where?

**Me:** Let me validate this. On the "place bowl" step—where are we getting it from?

**Them:** This is wrong. It should be packaging.

**Me:** Packaging to garnish workstation. That would be a single transfer step.

**Them:** Maybe because packaging isn't a substation in the schema. Is it in there?

**Me:** If it's not, we can add it.

**Them:** I'm wondering if missing substations are screwing up what it's trying to do.

**Me:** Yeah.

**Them:** Oh, packaging is listed.

**Me:** Some of the issue is your line builds still talk as if it's "place bowl"—we haven't told the agent to interpret place steps as mapping to a single transfer.

**Them:** Can we look at the data? I want to pull up exactly what I gave you. How did I get that to you? Complexity scorecard for Indian Turbo page, January.

**Me:** What are you looking for?

**Them:** The Excel file I sent you.

**Me:** Test items. Let me find it.

**Them:** Okay. The item packaging column is almost always describing the "from." If it's NA, it assumes the workstation—except for the cook step, which describes where it's going.

**Me:** So I should know. Should be 75.

**Them:** If the transfer program knows that rule, it clears up a lot of it.

**Me:** This makes sense. When you're doing cold rail location, you're embedding a transfer step by just saying this—that wasn't an assumption we had given the agent.

**Them:** Yeah. When structured this way, the view where "the thing just appears in line" is exactly what's happening. Same with dry rail. When you get to cooking equipment, it falls apart. Otherwise all these locations are deriving the material flow. Then there's "from Water Bath Station" describing a transfer on the receiving end.

**Me:** Are you talking about your screen?

**Them:** No, what was on your screen. If you scroll up to row 22, see how there's a location "from Water Bath Station" saying I'm retrieving from the station?

**Me:** Yeah.

**Them:** I'm taking into account the layout, paying attention to which ones are transfers. This is wrong—it should be water bath. Those are the mistakes that can happen.

**Me:** What does this mean? This is from cold storage, taking the brisket, but it's not putting it into the water bath already.

**Them:** No. To count complexity, I needed a step accounting for where the thing was coming from—a pre-cook step preparing to cook, finding the ingredient. Technically you could go from storage right into water bath for anything in the pouch. But more important than skipping that step was saying "I'm now putting something in the water bath"—finding it, putting it in, finding it. Even though I'm calling it a location, it's really about how hard it is to find the thing. The hardest part is going to cold storage, dry rail, etc. In cooking steps, the hardest part is going to equipment, water bath, turbo.

**Me:** Yeah.

**Them:** There's no good way to say the cook step starts from the station—so I describe the "to" instead of the "from."

**Me:** So you did this to have two separate steps because there's meaningful complexity in finding it and then actually putting it in.

**Them:** Exactly. I had to separate it into two steps. Cook steps almost always originate from the work surface, so that's not a valid "from" location—it's where it's going.

**Me:** Okay.

**Them:** If the transfer program knows that rule, it clears up a lot.

**Me:** We've cleared up a lot of assumptions. Before another generation, you should chat with the agent. We'll give it these rules and prime it: "there's a bunch of other stuff like this." Tee up the clearest parts where this breaks or doesn't make sense—we've already provided examples from this conversation. It can tease out anything else implicit in the modeling.

**Them:** Yes.

**Me:** You don't have to look for it yourself. It can just say "this is another part where smushing them together..."

**Them:** Yeah. And that inner cold transfer—how do I describe that without telling someone to build it the same exact way, knowing I'll remove the complexity there? In our system, I want all those transfer steps in there because it makes everything consistent. Then later we'll negate that score to zero because it's an interstation/substation transfer on a cold pod. The data flow is still valid.

**Me:** Yeah.

**Them:** Okay, I can do that whenever.

**Me:** Can you validate the test data is in your folder?

**Them:** Which folder would it be in?

**Me:** It's in the POC folder, line build CLI, test items data.

**Them:** Data, fixtures? No, test items data. Oh, it's a CSV.

**Me:** Yeah. I'll test a prompt on my side and give it to you—just copy-paste and it'll start reading that data and ask you questions.

**Them:** Yes, let's do that. So you're going to give me the prompt to put into Claude?

**Me:** Yeah. Just open it up, copy-paste, and it'll work the same way.

**Them:** One big thing missing from the latest version: technique. It's still not in there.

**Me:** Okay.

**Them:** Ideally it would take the technique column—training approved—and assign a technique to every step.

**Me:** Every step but transfer steps?

**Them:** Transfer is a pass technique. Every step has some sort of technique.

**Me:** You want every transfer to be "pass"? Even when retrieving from storage?

**Them:** What if every step has a technique, and if it's a transfer, we call it "transfer" and code it so every time you see "pass," rename it "transfer."

**Me:** We're deriving transfer steps. I can auto-fill "pass" if that works. We now have...

**Them:** I don't think you need to derive transfer steps.

**Me:** When I say "derive," I mean if we define material flow by saying "from this to this," you're not really saying it's a transfer step—you're describing a path. We're encoding that as a transfer step. We're not asking the agent to tell us it's a transfer. You just describe how it flows step by step.

**Them:** Yeah. The transfer is implied by giving the input/output.

**Me:** Yeah.

**Them:** If input and output are two different locations, there's an implied transfer. The hard-coded pass steps are station-to-station transfers—except I might be missing transfers from garnish to press or garnish to toaster back to garnish because it's on the same station. Those can be self-implied: "hey, this is weird, we have a station jump here, let me add a transfer step." Then when we define station layouts, we tell it to ignore those transfers and not consider them a bounce.

**Me:** I'm realizing I need to give you an updated file because some rules we talked about change things. The agent will ask you questions because it has a set of rules. Sublocation for transfers: inventory to this, or station-to-station. Work steps: work surface. Cook things: equipment. That rule wasn't encoded.

**Them:** I see.

**Me:** I'll update it like we talked about. I'll give you a new zip file with the interview prompt. You just interview it—keep going until you feel it's not finding anything else. It'll keep asking. You can answer each one, or at a certain point say "treat all situations like this."

**Them:** Is it going to ask per instance or for a rule? Run the rule, find the next issue, or take each variation and have me validate it?

**Me:** Some rules will invalidate others. It's reading the test data, trying to find potential conflicts or places not 100% matching our rules—that's where it asks. I can change the prompt to apply patterns: "if this clears up all other issues, don't continue asking the same question."

**Them:** The test set is small enough that if it needs to be repetitive, I'm happy to keep giving the same answer to make sure we're happy with the generated rules.

**Me:** It's pretty likely you'll get to a place where it says "I've covered all the issues." There might be situations where your feedback breaks a rule—we'd have to go back to the drawing board.

**Them:** Okay, yeah.

**Me:** Okay.

**Them:** Great. And you're also going to add the techniques?

**Me:** Everything is a technique. For transfer, I'll throw in "pass."

**Them:** A missing field.

**Me:** What you're saying.

**Them:** Or call it "transfer" like it isn't explicit.

**Me:** I can just put "transfer" there.

**Them:** Yes. One step back, three steps forward. Back and forth.

**Me:** We're getting closer. Once we get this in line, it's a straight shot to the solution.

**Them:** I love the stuff that showed back in about the complexity score.

**Me:** Does that look good? That kind of functionality?

**Them:** The range is messed up—showing things over 100. General sales is 141, but you set complexity score as out of 100.

**Me:** It's not a percentage. The green/yellow/red/orange is a percentage range. I can normalize to 100 if you want.

**Them:** Got it. Don't. I'm curious how this actually comes out. Cheese fries is stupid hard for some reason. Things are falling about where they should. Speed lines, BYOs have extra steps built around worst-case scenario. For those to be 75 with that in mind is probably fine. Realizing complexity for speed line should be low—except for quesadilla, burrito, and tacos.

**Me:** You see the "manage" at the top? Try adjusting something. Some is pulled from your current sheet, some derived because we have more data now.

**Them:** Category multiplier, structural signals—cool. Back-to-back equipment. This is bundling up the things I was trying to capture. Technique weights—oh, these are derived techniques. That was the problem. You've got sous vide, broil. "Retrieve move sprinkle" is one I use on so many lines but it's not here.

**Me:** Do you want to give me a pruned list of techniques?

**Them:** That was the red flag. In the spreadsheet—oh, because it's CSV. There were tabs with all the techniques. It has a database.

**Me:** Do you want me to go with that?

**Them:** Yeah. The CSV still has the tabs. There's a key. You could import that. It should help drive complexity scores the way it was discussed with ops and Jen's team.

**Me:** Yeah.

**Them:** Yeah, I think...

**Me:** You didn't change something and then...

**Them:** That's cool.

**Me:** I'll show you. I didn't build this too much—just enough to preview. Try swapping something.

**Them:** Let's say I want to make hot side harder. Hot side weight is 3. I hit save changes.

**Me:** No, scroll down. You expanded everything. This should be at the top now.

**Them:** So what is this? Of 20 builds, two switch from medium to low, one goes from low to medium?

**Me:** It's percentage-based—more saying they swap places. One took the other's rank.

**Them:** That makes sense. One line build flip-flopped. What does P95 mean? The hardest of the hard went up 11 points, the average went up 10.

**Me:** 95th percentile went up 11.5. Standard deviation only went up 2.3.

**Them:** The 95th percentile—the hardest ones. If I clump those up, how did their scores change? Went up 11. This part's cool. You're explicitly saying based on that change, complexity went up 19, ranking went up 6.

**Me:** This is something where you could talk with Claude and jigger it around. If it doesn't have data, I can see if we can pull it in. You can do a lot of cool stuff for free.

**Them:** I could be like "why do you have cheese fries so hard?" and "give me all the steps making it look really hard," then reevaluate and apply to the portfolio.

**Me:** Yeah, exactly.

**Them:** Wow. This is scary. Those are very cool.

**Me:** We're doing so much plumbing to rip out the bad stuff, but once it's there...

**Them:** I agree. I just hate when it's like "oh, we did talk about this already" and now it's like...

**Me:** It's a lot of "we thought it was good, but it actually wasn't." Until it is.

**Them:** Those are dope. Wait—do we have a meeting tomorrow?

**Me:** Yeah.

**Them:** With Jen and Doug, I think. If I can get this cleaned up for that, I blow him out of the water.

**Me:** Would you be free at 2:30 today?

**Them:** I have a lot going. However... yeah, I can make that work.

**Me:** I grabbed time with Jen to get feedback so we're not going into tomorrow blind. We can have a pre-discussion before doing it in front of Doug.

**Them:** I think this is so cool. Even if it doesn't work, the setup—being able to tell it corrections and it does it. To have a score we can quickly make sense of how it's derived—so much easier than my spreadsheet. My spreadsheet has these values but lots of calculations happening in the background. There's a big leap of faith between the two. This is "what you see is what you get."

**Me:** What you see is what you get. No assumptions.

**Them:** For me, the weight of being accurate in a spreadsheet is gone. If it says one thing one day, then the next day something else because I mistyped or shifted lines down—it's totally messed up. That's gone.

**Me:** If anything's off, ask the agent to fix it. It's fixed across the whole portfolio.

**Them:** That's amazing. I had a meeting with Jen, Doug, and Michael from Spice yesterday. We gave him the complexity score, and he's trying to figure out how to build systems off that. He has to make assumptions and vet them against me or Jen. I showed him the workflow, and he's like "this makes so much more sense as to what's happening." The graph of how what we're working on. I only have the quesadilla, but I think we bring that up Thursday. When complexity is good—even if it's actually better that it's on the line build—to get him early access so he can answer his own questions. We don't have to guide him to a decision where he's like "you didn't tell me about this dish that makes this not work." He can probe and check.

**Me:** Yeah.

**Them:** Super. I know it's still beta, but could be interesting to see how much weight Doug gives to that.

**Me:** It's really just figuring out the rules. We've been circling around "what's the right way to model?" Today we talked about some of that. Also: how do you reinterpret CSV assumptions? Those are two separate things. The rules are good. The flow of generating a new thing is perfect. The CSV import is: how do we not delete all the work already done? And tease apart those assumptions because they're not obvious.

**Them:** Yeah. Okay.

**Me:** Okay. Let me add you to the thing.

**Them:** All right, so 2:30.

**Me:** Yeah. You talking about this will come across more closely since you're way more in the weeds. Speaking to how this would be better. Sweet. I'll get you the updated thing and prompt.

**Them:** Looking forward to it. Thanks so much.

**Me:** Thanks. Bye.
