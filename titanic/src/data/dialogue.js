/**
 * Dialogue trees (ARCHITECTURE.md §2). Original lines only; parodic names. Node text ≤ 140 characters per line.
 */
const N = (speaker, text, next = null, extra = {}) => ({ speaker, text, next, ...extra });
const C = (text, next, effects = null, conditions = null) => ({ text, next, ...(effects ? { effects } : {}), ...(conditions ? { conditions } : {}) });

export const DIALOGUES = {
  fio_boarding: { npcId: 'fio', start: 'a', nodes: {
    a: N('fio', 'Jack! We are on it. We are on the biggest thing that floats and it smells of paint. Smell it!', 'b'),
    b: N('player', 'A pair of threes, Fio. Best hand I ever lost on purpose.', 'c'),
    c: N('fio', 'Clean beds, hot soup, a toilet that flushes by itself. We are rich men. Where do rich men go first?', null, { choices: [
      C('The bow. Right to the point of it.', 'd'), C('Our berth. I want to see the clean beds.', 'e'), C('Up. As high as they let us.', 'f', [{ type: 'reputation', faction: 'third', delta: 1 }]) ] }),
    d: N('fio', 'The bow! Yes. If anyone asks, we are inspecting the anchors.', null),
    e: N('fio', 'G-62. Four bunks, two of them ours. I will take the top so I can see America first.', null),
    f: N('fio', 'High is where the hats are. We go high and we tip our hats. Is a free country up there, probably.', null),
  } },
  cal_suite: { npcId: 'cal', start: 'a', nodes: {
    a: N('cal', 'Naturally the suite is the finest aboard. I asked for the finest. Things tend to arrive when I ask.', 'b'),
    b: N('rosie', 'The paintings arrived, Cal. You said they were a waste of money. I hung them anyway.', 'c'),
    c: N('cal', 'Rosamund collects things with no obvious use. Stray painters. Stray ideas. And now, apparently, strays.', null, { choices: [
      C('Just admiring the view, sir. Then I will be on my way.', 'd'), C('The paintings are good. Whoever chose them has an eye.', 'e', [{ type: 'reputation', faction: 'first', delta: 1 }]), C('Say nothing and leave.', null) ] }),
    d: N('cal', 'Do. The view is better from the deck you paid for.', null),
    e: N('rosie', 'Frankly, that is the first sensible thing anyone has said in this room. Mr. ... ?', 'f'),
    f: N('player', 'Drawson. Jack Drawson. I draw people. Faces mostly.', 'g'),
    g: N('killjoy', 'Steerage, sir. He will be forward, low, and loud. They always are. This way, lad.', null),
  } },
  fio_bow: { npcId: 'fio', start: 'a', nodes: {
    a: N('fio', 'Jack. Jack. Look at it. There is nothing in front of us. Nothing! All the way to America!', 'b'),
    b: N('player', 'Top of the ship, Fio! Next stop: the whole world!', 'c'),
    c: N('fio', 'Dolphins! They race us. They are losing. Everything is losing to us today.', null),
  } },
  tommy_ireland: { npcId: 'tommy', start: 'a', nodes: {
    a: N('tommy', "That's the last of Ireland, lad. Forty-six thousand tons of ship and they still can't spare us a window.", 'b'),
    b: N('player', 'You get the whole stern rail. Most people pay extra for that.', 'c'),
    c: N('tommy', "Aye, and most people pay extra for a chair with their name on it. Tommy Brannigan. You'll be the artist.", null, { choices: [
      C('Jack Drawson. How did you know?', 'd'), C('The artist. The card player. The man with the clean bunk.', 'e', [{ type: 'reputation', faction: 'third', delta: 1 }]) ] }),
    d: N('tommy', 'Charcoal on the cuffs, lad. And nobody else stares at the water like it owes them a picture.', null),
    e: N('tommy', "A party's a party on Saturday. Nobody checks your ticket at a reel. Bring your boots.", null),
  } },
  stern_rescue: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', "Don't come any closer. Frankly, I'd rather you didn't watch either.", null, { choices: [
      C('I was not watching. I was wondering how cold it is down there.', 'cold'), C('Fine. I will just stand here and wait my turn.', 'turn'), C('Come back over the rail.', 'order') ] }),
    order: N('rosie', 'You do not get to tell me what to do. Nobody who has not met me gets to tell me what to do.', null, { choices: [ C('Then let me meet you. Jack Drawson.', 'cold'), C('Fair. I will wonder about the cold instead.', 'cold') ] }),
    turn: N('rosie', 'Your turn? There is a queue for this?', 'cold2'),
    cold: N('player', 'Two degrees below freezing. Like a thousand knives. I went through the ice once as a boy. You stop breathing.', 'cold2'),
    cold2: N('rosie', 'You are trying to frighten me out of it.', null, { choices: [
      C("No. I'm telling you what happens so you can choose it properly.", 'hand', [{ type: 'reputation', faction: 'first', delta: 1 }]), C("Yes. Is it working?", 'hand2') ] }),
    hand: N('player', "Here's how it goes: you let go, I come after you. So neither of us lets go. Give me your hand.", 'slip'),
    hand2: N('rosie', 'A little. Frankly, mostly I am cold.', 'hand'),
    slip: N('narrator', 'She turns. The gown catches the rail. Her shoe slips on the wet iron and for a moment there is only the propeller wash below.', 'caught'),
    caught: N('player', 'I have you. I have got you. Look at me, not down. Rosie, look at me.', 'cal'),
    cal: N('cal', 'What is this? Killjoy. Master-at-Arms. What has this man done to my fiancée?', 'rosie2'),
    rosie2: N('rosie', 'I leaned over to see the propellers, Cal. I slipped. Mr. Drawson caught me. Naturally you will want to thank him.', 'cal2'),
    cal2: N('cal', 'Naturally. Perhaps a small something for the hero. Twenty dollars?', null, { choices: [
      C('Is that the going rate for saving the woman you love?', 'dinner', [{ type: 'reputation', faction: 'first', delta: 1 }]), C('Keep it. Buy her a lamp for the rail.', 'dinner') ] }),
    dinner: N('rosie', 'Cal. Mr. Drawson will join us for dinner on Saturday, to tell our table a heroic tale.', 'end'),
    end: N('cal', 'Saturday. The dining saloon, eight bells. Do try to find a coat.', null),
  } },
  promenade_walk: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'You have been staring. Either sketch me or confess you have forgotten how eyes work.', 'b'),
    b: N('player', 'I draw people. Faces mostly. Hands if they will sit still, which they will not.', 'c'),
    c: N('rosie', 'Show me. Frankly, if they are terrible I shall say so, and you may push me overboard this time.', null, { choices: [
      C('Hand her the portfolio.', 'd'), C('Only if you promise not to be kind.', 'd') ] }),
    d: N('rosie', 'These are... these are good. This woman. You loved her?', 'e'),
    e: N('player', 'Only her hands. She had the best hands in Paris. The rest of her belonged to a baker.', 'f'),
    f: N('rosie', 'You see people, Jack. Most people here only see what a person costs.', null),
  } },
  spitting_lesson: { npcId: 'rosie', start: 'a', nodes: {
    a: N('player', 'Lesson one. You hawk it from the back. Lean out. Mind the wind. Arc, not drop.', 'b'),
    b: N('rosie', 'That is the most disgusting thing I have ever been taught and I attended finishing school.', null, { choices: [
      C('Spit for the sea.', 'c'), C('Aim for the deck below. Just once.', 'd', [{ type: 'reputation', faction: 'first', delta: -1 }]) ] }),
    c: N('narrator', 'A clean arc into the Atlantic. Behind you, a throat is cleared. Three hats and a lorgnette have come round the corner.', 'e'),
    d: N('narrator', 'A second-class passenger on the promenade below looks up with murder in his eyes. Behind you, a throat is cleared.', 'e'),
    e: N('prudence', 'Rosamund. One does not do that, dear. One does not do that even in Pittsburgh.', 'f'),
    f: N('dolly', 'Sonny, you must be the hero from the stern. Sit down before you fall up. You dining Saturday? Got a coat?', null, { choices: [
      C('A coat is the one thing I did not win at cards.', 'g'), C('I have a jacket. It has an elbow.', 'g') ] }),
    g: N('dolly', 'My boy left a dinner suit in my trunk and his manners in Denver. B-4, six o clock. We will make you shine.', null),
  } },
  dinner_descent: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'Mr. Drawson. You almost pass for a gentleman. Honour and Glory are watching; try to live up to the clock.', 'b'),
    b: N('player', 'I have been practising kissing hands on the staircase rail. The rail was not impressed.', 'c'),
    c: N('rosie', 'The rail has standards. Come. Mother is below, sharpening something.', null),
  } },
  dinner_duel: { npcId: 'cal', start: 'a', nodes: {
    a: N('dolly', 'Start from the outside and work in, honey. Same as a mine. Same as a marriage.', 'b'),
    b: N('prudence', 'Mr. Drawson, how fascinating. And where does one live, when one lives nowhere?', null, { choices: [
      C('Wherever the next sketch is. Right now, in the finest ship ever built, courtesy of a lucky hand.', 'c', [{ type: 'reputation', faction: 'first', delta: 1 }]), C('G deck. It has a window if you count the porthole.', 'd') ] }),
    c: N('cal', 'A lucky hand. How refreshing. You find life a game of chance, then?', 'e'),
    d: N('prudence', 'How... resourceful.', 'e'),
    e: N('player', 'Every day is a card you have not turned over. I like to make each one count.', null, { choices: [
      C('Raise a glass: to making each day count.', 'f', [{ type: 'reputation', faction: 'first', delta: 1 }]), C('Eat the fish before it gets cold.', 'g') ] }),
    f: N('dolly', 'Hear, hear! To making it count. Sonny, that was the right fork too.', 'h'),
    g: N('captain', 'A sound philosophy for a sailor, young man. Fish, then.', 'h'),
    h: N('cal', 'The gentlemen will withdraw to the smoking room. Brandy and the future of steel. Not your subjects, I think.', 'i'),
    i: N('narrator', 'As the men rise, a folded note finds its way into her glove: Make the clock. Bring shoes you can dance in.', null),
  } },
  steerage_party: { npcId: 'fio', start: 'a', nodes: {
    a: N('nora', 'You draw badly. Dance with me anyway. You have to hop on one foot or it does not count.', 'b'),
    b: N('fio', 'Jack! The rich lady is here! Rosie! Tommy, play something that she cannot keep up with!', 'c'),
    c: N('rosie', 'I can keep up with anything played in time. Frankly, I am not sure your friend can.', null, { choices: [
      C('Take her hand. Reel.', 'd'), C('Hand her a pint first.', 'e', [{ type: 'reputation', faction: 'third', delta: 1 }]) ] }),
    d: N('narrator', 'A reel, then a faster reel. Boots on the benches. She kicks off her shoes and stands on her toes, and the room cheers.', 'f'),
    e: N('rosie', 'A whole pint. Watch.', 'd'),
    f: N('tommy', 'Now, lad. Arm on the table. If you win, the pretty one dances with me.', null, { choices: [ C('You are on.', 'g'), C('She chooses her own partners, Tommy.', 'h', [{ type: 'reputation', faction: 'first', delta: 1 }]) ] }),
    g: N('tommy', 'Ah, now. Charm is not a trade, but it is a grip. Best of three, missus?', 'i'),
    h: N('rosie', 'Correct. I choose Mr. Brannigan for one reel and you for all the rest.', 'i'),
    i: N('narrator', 'On the stairwell a bowler hat watches, and leaves.', null),
  } },
  turned_away: { npcId: 'promptly', start: 'a', nodes: {
    a: N('promptly', 'Divine Service is for first class, sir. The coat is very good. The boots give you away.', null, { choices: [
      C('Could a message reach a lady at the service?', 'b'), C('I will go up and drop a note through the gymnasium window.', 'c'), C('Swap coats with somebody in the library. Later.', 'c') ] }),
    b: N('promptly', 'Mr. Hockstone tips in advice. Mrs. Beige tips in money. Guess whose rooms are warmest. Give me the note.', 'd'),
    c: N('promptly', 'I did not hear that, sir. Lifts are for passengers. Fortunately I have never been able to tell a passenger from a face.', 'd'),
    d: N('promptly', 'She will hear the bow at sunset. Quarter past six. I was never here.', null),
  } },
  flying: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'You wanted the bow. Here is the bow. It is extremely windy and I think I have lost a hairpin to Newfoundland.', 'b'),
    b: N('player', 'Close your eyes. Step up on the rail. Hold the rail. Now open them.', 'c'),
    c: N('rosie', 'Where are we?', null, { choices: [ C('Flying. Badly. Hold on.', 'd'), C("Everywhere. There's nothing in front of us.", 'd') ] }),
    d: N('narrator', 'The sun goes into the sea at the real azimuth of 14 April 1912. She leans back. He does not let go.', null),
  } },
  the_portrait: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'The Heart of the Deep. Cal keeps it in the safe like a receipt. Draw me wearing it. Only it.', 'b'),
    b: N('narrator', 'The charcoal is sharpened. The lamp is turned down. The game looks away.', 'c'),
    c: N('rosie', 'There. Sign it. Put the date, so that someday somebody argues about it.', null, { choices: [
      C('Sign it J.D. and the date.', 'd'), C('Sign it with a sketch of her hand.', 'd', [{ type: 'reputation', faction: 'first', delta: 1 }]) ] }),
    d: N('rosie', 'I shall leave it in the safe with a note for Cal. Something about being sold with the silver. Then we run.', null),
  } },
  the_car: { npcId: 'rosie', start: 'a', nodes: {
    a: N('player', "Your carriage, miss. The chauffeur regrets he is in the boiler room shovelling coal.", 'b'),
    b: N('rosie', 'Then you will have to drive. Badly, I expect.', null, { choices: [ C('Where to, miss?', 'c'), C('Get in before Killjoy finds the hold.', 'c') ] }),
    c: N('rosie', 'To the stars. Frankly, anywhere with a door that shuts.', 'd'),
    d: N('narrator', 'The door shuts. Fade to black. Fade up: twenty-five to midnight on the forward well deck, the air like glass, her coat buttoned wrong.', null),
  } },
  rivetts_verdict: { npcId: 'rivetts', start: 'a', nodes: {
    a: N('rivetts', 'Mail room afloat. Squash court filling. Five compartments open to the sea. She was built to float with four.', 'b'),
    b: N('captain', 'Mr. Rivetts. How long?', 'c'),
    c: N('rivetts', 'She will founder. An hour. Perhaps two. There are not enough boats; there were never enough boats.', 'd'),
    d: N('captain', 'I see. Uncover the boats. Quietly.', null, { choices: [ C('Say nothing. You heard.', null), C('Ask: what should we do?', 'e') ] }),
    e: N('rivetts', 'Lifebelts, and go up. Do not wait to be told twice; nobody is going to tell you twice tonight.', null),
  } },
  planted_jewel: { npcId: 'cal', start: 'a', nodes: {
    a: N('player', 'Cal. Mrs. DeWitt-Bouquet. The ship is going down. Mr. Rivetts says an hour, two at most. Lifebelts, now.', 'b'),
    b: N('cal', 'Naturally the steerage boy brings the news. Killjoy, is anything missing from my safe?', 'c'),
    c: N('killjoy', 'The stone, sir. And the lad has roomy pockets. Interesting coat.', 'd'),
    d: N('narrator', "Killjoy's hand brushes the borrowed coat. When it comes away, the Master-at-Arms is already reaching into the pocket.", 'e'),
    e: N('manacle', 'Now then. A gentleman says you have a sapphire in your coat. And here it is. Let us have the coat, son.', null, { choices: [
      C('He put it there. You watched him do it.', 'f'), C('Rosie. I did not take it. You know I did not.', 'g') ] }),
    f: N('cal', 'A convenient story. Master-at-Arms, your office, I think. Rosamund, with me.', 'h'),
    g: N('rosie', 'I know. Cal, I know he did not.', 'h'),
    h: N('rosie', null, null, { choices: [ C('(Rosie) "Then I am going with him."', null, [{ type: 'reputation', faction: 'first', delta: 1 }]), C('(Rosie) "Cal, this is beneath even you."', null), C('(Rosie) Say nothing. Go with Cal.', null, [{ type: 'reputation', faction: 'first', delta: -1 }]) ], text: 'Rosie looks from the stone to Cal to the door.' }),
  } },
  arrest: { npcId: 'killjoy', start: 'a', nodes: {
    a: N('manacle', 'I will be back for you directly. Do not go anywhere.', 'b'),
    b: N('killjoy', 'He will not be back, lad. He has a ship to empty. I were a constable twelve years; I know the look of a man who has forgotten you.', 'c'),
    c: N('player', 'The stone is in your pocket, Spicer. Whatever happens tonight, it goes down with you or it does not.', null, { choices: [ C('Say nothing else.', 'd'), C('Rosie will come.', 'e') ] }),
    d: N('killjoy', 'Every ship has a cellar. Every cellar has a locked door. I am patient, sir. You will not need to be.', null),
    e: N('killjoy', 'Down here? In that? If she comes, lad, she is a better man than both of us.', null),
  } },
  boat_refusal: { npcId: 'rivetts', start: 'a', nodes: {
    a: N('rivetts', 'Miss Bouquet. Go up. Get in a boat. Do not wait for me to say it kindly; I have run out of kindly.', 'b'),
    b: N('cal', 'The boat, Rosamund. Boat six, with your mother. I have arranged everything. Everything.', null, { choices: [
      C('Where is Jack?', 'c'), C('I am not getting in the boat, Cal.', 'd'), C('Arranged. Like the sapphire in his pocket.', 'd', [{ type: 'reputation', faction: 'first', delta: 1 }]) ] }),
    c: N('cal', 'In a cellar, with a policeman. Where thieves go. Get in the boat.', 'd'),
    d: N('rosie', 'I will not be sold with the silver. Not even in a very nice box. Mr. Rivetts, the Master-at-Arms office: how do I get down?', 'e'),
    e: N('rivetts', 'The crew stair by the lifts, then forward along E deck. Scotland Road. Keep to the right; the water is to the left. Go.', null),
  } },
  axe_rescue: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'Jack. Jack, I have an axe and I have never used an axe.', 'b'),
    b: N('player', 'Practice on the cabinet. Once. Then the chain, not my hands. Give me the axe.', null, { choices: [
      C('(Rosie) "No. I have seen you aim. I am keeping the axe."', 'c'), C('(Rosie) Hand it over.', 'd') ] }),
    c: N('narrator', 'One swing wide; a nick in the pipe. The second swing takes the chain clean. The water is at the desk.', 'e'),
    d: N('rosie', 'No. I have seen you aim.', 'c'),
    e: N('player', 'That is the first thing you have done tonight I would not have dared. Up. Now. Left is water.', null),
  } },
  the_gates: { npcId: 'tommy', start: 'a', nodes: {
    a: N('tommy', 'Locked. Grand. We have had a word with the lock. It is not listening.', 'b'),
    b: N('fio', 'A ship is nothing but doors, yes? This one is a bad door. Jack! The bench!', null, { choices: [
      C('Tear the bench from its bolts. Ram the gate.', 'c', [{ type: 'reputation', faction: 'third', delta: 1 }]),
      C('Steward Promptly. You never saw me.', 'd', null, { flag: 'dinner_jacket' }),
      C('Nora first. Lift her over.', 'e', null, { reputationMin: { faction: 'third', value: 4 } }) ] }),
    c: N('narrator', 'Three runs and the lock gives. The steward beyond flees. Everyone up.', null),
    d: N('promptly', 'I was never here, sir. Lifts are off. Stairs are free. Go.', null),
    e: N('nora', 'You have to lift me on one foot or it does not count.', 'c'),
  } },
  the_boats: { npcId: 'heartstring', start: 'a', nodes: {
    a: N('heartstring', 'Gentlemen, ragtime for the nerves. Something with a lift. Nobody panics in two-four.', 'b'),
    b: N('cal', 'Rosamund. Collapsible D. Mr. Drawson has an arrangement; I have seen to it. Get in.', null, { choices: [
      C('(Rosie) Get in the boat.', 'c'), C('(Rosie) "What arrangement?"', 'd') ] }),
    d: N('cal', 'A boat on the other side. For gentlemen. Get in, Rosamund, or I will carry you.', 'c'),
    c: N('narrator', 'The boat drops past A deck. She looks up at him. She climbs the rail of the open promenade and jumps back aboard.', 'e'),
    e: N('rosie', 'I will not be sold with the silver. Jack!', null),
  } },
  reunion: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'You are an idiot. You should have been on the other side in a boat for gentlemen.', 'b'),
    b: N('player', 'There is no boat for gentlemen. There never was. Water through the dome. Up, Rosie. Aft, then up.', null, { choices: [ C('Run.', 'c'), C('Wait: Cal.', 'd') ] }),
    c: N('narrator', 'A shot into the chandelier above the stairwell. Crystal falls into the rising water. He runs out of bullets and reasons.', null),
    d: N('cal', 'I hope you enjoy each other. Then I hope you enjoy the Atlantic.', 'c'),
  } },
  hold_on: { npcId: 'rosie', start: 'a', nodes: {
    a: N('player', 'The rail. The outside of it. Like the first night. Hold on to it like it owes you money.', 'b'),
    b: N('rosie', 'This is where we met. Frankly, I had hoped for a better anniversary.', 'c'),
    c: N('player', 'On three, breathe out. In. Then kick away from her, hard, and keep kicking. Keep talking to me.', null, { choices: [ C('One. Two.', null), C('Tell me about Wisconsin winters.', 'd') ] }),
    d: N('rosie', 'You tell me. I was never there. You will have to take me. One. Two.', null),
  } },
  the_panel: { npcId: 'rosie', start: 'a', nodes: {
    a: N('rosie', 'Get on. Jack, get on, there is room.', 'b'),
    b: N('narrator', 'The panel tips. He slides back into the black water and holds her hands instead.', 'c'),
    c: N('player', 'Keep breathing. Keep kicking. Keep talking to me, Rosie. Tell me about the first thing you will do.', null, { choices: [
      C('(Rosie) "Ride a horse on a beach. Astride. Frankly, like a man."', 'd'), C('(Rosie) "Try to climb on beside you."', 'e') ] }),
    e: N('rosie', 'Buoyancy, not area, Jack. Stay with me.', 'd'),
    d: N('player', 'Promise me you will do it. Promise me you will not give up, whatever happens. Promise me, Rosie.', 'f'),
    f: N('rosie', 'I promise. I will never let go of that promise.', 'g'),
    g: N('narrator', 'A whistle. Lights among the debris. One boat has come back. Her hands let go of his, and she swims toward the whistle.', null),
  } },
  epilogue_choice: { npcId: 'oldrosamund', start: 'a', nodes: {
    a: N('oldrosamund', 'A woman keeps her secrets, Mr. Lootwell. She also keeps her sapphires. Usually in a coat pocket.', 'b'),
    b: N('narrator', 'Barefoot at the stern rail. The Heart of the Deep in her hand over the black water.', null, { choices: [
      C('Drop it.', 'c', [{ type: 'setFlag', flag: 'dropped_the_jewel' }]), C('Keep it one more night.', 'd', [{ type: 'setFlag', flag: 'kept_the_jewel' }]) ] }),
    c: N('oldrosamund', 'There. The sea keeps her secrets. She can keep that one too.', 'e'),
    d: N('oldrosamund', "A woman's heart is a deep ocean of pockets. One more night.", 'e'),
    e: N('narrator', 'On the nightstand: flying lessons, a pier, a horse on a beach. Then the staircase, every face applauding, and a man by the clock.', null),
  } },
  // ambient dialogues (flagged ambient so the quest manager can start them from a plain greeting)
  promptly_default: { npcId: 'promptly', ambient: true, start: 'a', nodes: { a: N('promptly', 'Lifts are for passengers, sir. Fortunately I have never been able to tell a passenger from a face. Where to?', null, { choices: [ C('A deck.', null, [{ type: 'teleport', locationId: 'lift_lobby_A' }]), C('E deck.', null, [{ type: 'teleport', locationId: 'grand_staircase_E' }]), C('Nowhere just now.', null) ] }) } },
  heartstring_default: { npcId: 'heartstring', ambient: true, start: 'a', nodes: { a: N('heartstring', 'Requests? We take them. Something with a lift, or the hymn my mother liked.', null, { choices: [ C('Something with a lift.', null, [{ type: 'sound', id: 'bell' }, { type: 'setFlag', flag: 'band_ragtime' }]), C('The hymn.', null, [{ type: 'setFlag', flag: 'band_hymn' }]), C('Play what you like.', null) ] }) } },
};
