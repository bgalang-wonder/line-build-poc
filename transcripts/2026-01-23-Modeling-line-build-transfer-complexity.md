# Meeting Transcript: Modeling line build transfer complexity and workflow steps
**Date:** Jan 23, 2026

**Them:** Interstation transfers have complexity. Interstation transfers on the hotline—still within the same pod—are difficult because you have to cook something, it disappears off the screen, then comes back, and now you're using another piece of equipment with a new cook time. But all your instructions are still there. Early on when I was talking to the line build interview system, one thing it clearly picked up was: you're surfacing old information when presenting information to hotline cooks. That seems like a bad idea for efficiency.

**Me:** It derived that or it flattened?

**Them:** It knew that based on how I was describing the problem. It was like, "that's dumb, why would you do that?" So that's the check mark—it's a little more complex.

**Me:** Nice.

**Them:** As much as location-specific portal information is useful, we typically design to a default. We don't just say "this is what we want to do." We think about: this station, this pod has these two stations together so I can do parallel cooking on this patient.

**Me:** Yeah.

**Them:** Whereas if I have a turbo and a fryer, I can never do parallel cooking. If I have a piece of bread and a cheesesteak, they both go in the turbo but cook for different times. Because they're assigned to the same station—and happen to be the same piece of equipment—because they're on the same pod, I know those two things will cook at the same time. Line builds have that thought built in.

**Me:** Let me pull this apart. What I'm hearing is: we design to a default. There are multiple layers where you're mapping the equipment technique—what things need to happen in what sequence. That can happen to a default, agnostic to which HDR. When modeling these transfer steps, that's where one HDR might need an inter-pod transfer but another doesn't. That's hard to map to a default because it's purely based on config.

**Them:** Yes, except—let me try this. We ignore interstation. Interstation transfers are just as difficult as inter-pod transfers. That's the generalization we do in the complexity score right now.

**Me:** Yeah.

**Them:** Because we do that, and most of the time it's true enough. As long as this thing comes off the screen, comes on, it's almost the same as going to a different pod. So we made that generalization, captured as a transfer. We simplified reality by saying anytime it switches equipment, it's the same as switching pods. Which means turbo to fryer is the same as turbo to garnish or fryer to garnish—carries the same weight.

**Me:** I think we're diverging on the specifics of what a transfer means. There's a transfer that adds complexity, which is one dimension. But I'm more rooted on: I'm adding a transfer step to capture the time it takes to do this transfer. Let's assume it requires a person, so maybe it impacts sequencing.

**Them:** Off.

**Me:** Does that make sense? There's both: this is a harder operation, but also we need to account for the time—that there's movement happening.

**Them:** It does, but because we're not taking time into consideration originally—I guess in my head I'm ignoring that. But the way we're building this, we are able to quickly do that. With that in mind, that changes the framing of the conversation.

**Me:** Yeah.

**Them:** That's why every time something is moving from substation to substation—that makes me want to remove refrigerator, dry rail, cold rail to be honest. There should be a transfer.

**Me:** What do you mean when you said you want to remove?

**Them:** I want every—because those are areas you put something. Those are not areas where I'm taking my product. Cold rail, dry rail, cold storage and packaging, freezer—those are all one-way streets.

**Me:** You can only take, you can't put stuff there.

**Them:** Right. So in that sense, the time it takes to do the task is the transfer time. But that's maybe not—

**Me:** We're modeling retrieve steps. We can model: you have to grab something from the cold rail. That discrete step—we can assign time. It would add five seconds because you got to go grab that.

**Them:** Maybe. This is where I'm struggling. When we generalized to make it possible to do this in Excel, a lot of this was "lump it together." But now that we're getting prescriptive about what's happening at each step, it does make sense to bring it back.

**Me:** I know this is tough. I was thinking through this when processing information. I'm thinking of these granular spots that will get you what we want.

**Them:** Right.

**Me:** Because the agent's so good at mapping it.

**Them:** I've already simplified it down just to be able to computate this in my head.

**Me:** Yeah.

**Them:** That makes sense. Transfer steps live on every single step eventually. Anything that is not an assembly—there's a transfer. You're going from one substation to another: grill to work surface, fryer to work surface. There's a transfer there.

**Me:** Things within a single station where a couple actions happen but you're not moving, not leaving the station—no transfer there. Interstation, station to station, we would add a light transfer. Inter-pod, there'd be a slightly larger transfer step. What's your reaction?

**Them:** We're generalizing again. In theory, there's a transfer even going cold rail to workstation—I have to get the thing. We were previously doing: location was transfer time plus search time, or complexity—search complexity, movement complexity.

**Me:** I think—

**Them:** If we're doing it this way and want to be consistent—build the schema that's always true—anytime you go from substation to substation, there is a transfer. We'll count those as extremely low for cold rail, extremely low for dry rail, slightly higher for cold storage because it's underneath you, even higher for cold storage that's not a low boy.

**Me:** I think I'm understanding. We're circling around: from what frame are we modeling movement?

**Them:** Yeah.

**Me:** We have retrieve and we have place.

**Them:** Yeah.

**Me:** Technically those two are transfer steps because they're transferring something from one to another. We just need to be consistent.

**Them:** Yes, exactly.

**Me:** We can say retrieve and place, but the complexity is derived off of: was that an interstation? Was it inter-pod? Was it happening in the same? Maybe it's the same transfer step but took longer because this HDR is further away.

**Them:** Right. Because that's so HDR-dependent, we generalized it. We may want to continue generalizing some of it. I think it's okay to store it as: this transfer is happening. The transfer is implied by the from and to.

**Me:** My extrapolation: we don't use transfer. Everything is a retrieve or a place. If you're starting somewhere and need to go grab something, that's a retrieve. Place is taking something you have and putting it somewhere else. Those two generalize—you define that action. It looks different depending on whether you're retrieving at this HDR versus a different HDR. But any HDR, you're going to retrieve and place, just at different spots.

**Them:** When we say place, that's confusing because it is a technique and we treat it as not. Going with blank slate: retrieve means you have to go somewhere to get something. Do I have to go to the cold rail even if I'm standing in front of it? Is that how you understand it, or is that a place because it's close?

**Me:** Maybe generalize this: any place has to have a corresponding retrieve. But a retrieve might be from the same location, so it doesn't add complexity. You retrieved it, but there's no distance. Every retrieve and place allows us to have that "if this, then that."

**Them:** In conversation, I don't know if I could consistently say retrieve versus place, or every retrieve has a place—

**Me:** Some of this is how we model it.

**Them:** Derived.

**Me:** If you say you need to put this in the turbo—where are you getting it from? "Oh, I get it from over there." You just gave the retrieve and the place step.

**Them:** Isn't this the same thing as from and to?

**Me:** Semantically similar. But from and to doesn't imply who moved it—just saying it traveled this way. Retrieve is more like: the person at the station went to that other place to retrieve it. Place means you took it from this place and went to the other. From and to is more general—just saying it went to these places, not saying who did it.

**Them:** It always has to be a person.

**Me:** That's why I'm saying retrieve and place. That's directional. You're retrieving it from this to this. You're not simply saying it's moving from A to B—you're saying you started at B and retrieved it from A. There's directionality.

**Them:** I'll go along with this. I'm confused as to why, but if there's a clear difference, let's do that.

**Me:** Okay.

**Them:** Do we need the from and to?

**Me:** I think we don't. Retrieve and place encodes more information. But as long as you have that from and to style information and we can derive it naturally, you're feeling good.

**Them:** Yeah. This is where the confusion is: retrieve is a thing. You don't say "retrieve cold rail." I need the cold rail information. If I say I need to retrieve something—I'm retrieving the mayonnaise. The mayonnaise lives on the cold rail. How does that schema build out? Items have their own schema, while actions/techniques are physical. How do we clear that difference? Is it needed?

**Me:** Can you say that again?

**Them:** Previously: where is it coming from and where is it going? It's coming from a cold rail. What is coming? Mayonnaise is coming from the cold rail. The from is a location, the what is the component, the tools, the quantity—those are built into step information. If I'm saying my first step is "retrieve mayonnaise"—

**Me:** I need to correct what I said. I think I'm wrong. We map from and to of the components—how do the components move? Almost like assuming there wasn't a person there. If you zoom out and saw X-ray, only saw the food moving, we'd have from and to as things came together. A derived view would be: if one person were to do this, what would their path look like? They would have to retrieve it from here, then walk here. That can be derived from the from and to.

**Them:** Yes. From and to is just the endpoint, and retrieve is the path.

**Me:** When I was saying retrieve and place, that's very person-centric—assuming one person is doing this, ending at a station doing a flow, needing to go from that place to retrieve the thing. But if we had multiple people working on the line build, they may not retrieve from that station. They may just need to move that thing from A to B. That retrieve step encoded with the start location is wrong for that person. They just need from and to, because then they can come. That's why from and to is correct. Then we can say one person's doing this and derive the line build for one person and their travel path.

**Them:** Yes. The retrieve is a line build construction. The from and to is the schema.

**Me:** Yes.

**Them:** Okay.

**Me:** That's a good way of putting it. You had other questions?

**Them:** This all stemmed from transfer. Why does the HDR portal affect complexity? The realization was: we made assumptions about transfers. We simplified to say, agnostic of layout, all transfers matter unless they're transfers within the cold pod, the garnish pod. We weighted them all the same—I don't care if the microwave is on its own pod or microwave and fryer are on the pod together. We said station-to-station transfers. Then we got to: what is a substation, sub-location transfer? We said if we're getting that detailed, yes it matters, and everyone has weight—just somewhat easier than others. The storage location—we still need it because it's important to know where things are coming from. The generalization: it's easier to find things at different storage locations. Rails are easier than cold storage.

**Me:** Does that ever change per HDR? Like here it's in cold storage, but here it's on the cold rail?

**Them:** Packaging.

**Me:** Let me zoom out. This is where we can immediately test and see how it looks. The line build or schema is from and to—regardless of where you're at, this stuff needs to happen. With HDR-specific data, we can approximate: if you're at the same station, super low complexity, takes two seconds. Station to station has X complexity, takes this time. Pod to pod, maybe larger. We can derive and calculate: this line build, given our HDRs, is 80% actually high complexity. Even though on default it looked simple, the edge cases are such that when we map this out, most HDRs end up high complexity because of how pods are assigned.

**Them:** Luckily it's the opposite—we go with higher complexity because we don't have high throughput needs. What tends to happen: when we find a location doing really well, maybe during opening, we freak out and break all our systems to make this thing faster. Secretly: do more prep ahead, put another oven here. Stores do things that break from default to stay above water and maintain metrics. That's why I feel okay focusing on default.

**Me:** I see. We're always going to operate with the worst case.

**Them:** Yeah. The default.

**Me:** Be the default.

**Them:** Yeah. These details still matter even if we're doing default—to set it up so if we did start changing layouts, we don't have to go back to these line builds and add transfer stuff because we switched equipment around. Or refrigerators don't even exist because it's all meant for speed. That's the thought behind it.

**Me:** You could scenario and do what-if analysis against different layouts on that worst case and see if you change that, does everything move down together? The worst case is now able to do the better line build.

**Them:** Maybe you build high-volume pods—combine equipment or things because these are low-gov, high-volume items we can't afford to spend that much labor on. Remove all the transfer steps.

**Me:** I need to hop off, I have to call somebody outside of work. I can continue at 4:30 if you're available.

**Them:** I can do that.

**Me:** Cool. I'll climb back.

**Them:** All right.
