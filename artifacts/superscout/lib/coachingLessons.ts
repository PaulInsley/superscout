export type LessonKey = "captain" | "transfers" | "fixtures" | "ownership";

export interface CoachingLesson {
  key: LessonKey;
  round: number;
  headline: string;
  screen: "captain" | "transfers" | "either";
  content: Record<"expert" | "critic" | "fanboy", string>;
}

export const COACHING_LESSONS: CoachingLesson[] = [
  {
    key: "captain",
    round: 1,
    headline: "Your Captain Is Your Biggest Decision",
    screen: "captain",
    content: {
      expert:
        "Your captain scores double points. Over a full season, that\u2019s a 200\u2013300 point swing \u2014 more than any transfer you\u2019ll make. The three options below are ranked by expected return. The SuperScout Pick is highlighted, but the choice is yours.",
      critic:
        "See those three options below? One of them gets double points this week. Pick wrong and you\u2019ve handed your mini-league rivals a free head start. No pressure. Actually, plenty of pressure \u2014 that\u2019s what makes it fun.",
      fanboy:
        "YOUR CAPTAIN SCORES DOUBLE!! That means every goal, every assist, every bonus point \u2014 DOUBLED. Look at the three options below. The SuperScout Pick is the one I\u2019m most hyped about, but you\u2019re the boss!",
    },
  },
  {
    key: "transfers",
    round: 2,
    headline: "Transfers: When To Move and When To Hold",
    screen: "transfers",
    content: {
      expert:
        "You get one free transfer per week. Unused ones roll over, up to a maximum of 5. Each extra transfer beyond your free ones costs 4 points \u2014 which is rarely worth it. The options below include a \u2018Hold\u2019 option when standing pat is the smart play. Look at the fixture tickers to see why some moves make more sense than others.",
      critic:
        "One free transfer per week. Waste it and you wait another week. Take a hit \u2014 that\u2019s minus 4 points, by the way \u2014 and it better be worth it. The Hold option exists for a reason. Sometimes the best transfer is no transfer. I know that\u2019s boring. I don\u2019t care.",
      fanboy:
        "Transfer time! You get one free transfer every week \u2014 unused ones roll over (up to 5!!). The options below show who to bring in and who to let go. Check the fixture colours \u2014 green means EASY. If you see a wall of green next to a player\u2019s name, that\u2019s your sign!",
    },
  },
  {
    key: "fixtures",
    round: 3,
    headline: "Reading the Fixtures",
    screen: "either",
    content: {
      expert:
        "The coloured pills on each card show the next 5 fixtures. Green means a favourable fixture \u2014 FDR 1 or 2. Amber is neutral. Red is difficult \u2014 a top defence or a tough away trip. When comparing two players with similar expected points, the one with more green in their fixture run is usually the smarter pick over the coming weeks.",
      critic:
        "Those coloured pills under each player? That\u2019s their fixture run. Green means easy. Red means pain. If you\u2019re choosing between two players and one has a wall of green while the other is staring down red-red-red, this isn\u2019t a hard decision. You\u2019re welcome.",
      fanboy:
        "See those coloured pills? That\u2019s the FIXTURE RUN \u2014 the next 5 games! Green = easy fixtures = MORE POINTS POTENTIAL! Red = tough games = danger zone. When two players look similar, check the colours. A run of green is basically a cheat code!",
    },
  },
  {
    key: "ownership",
    round: 4,
    headline: "Ownership and the Crowd",
    screen: "captain",
    content: {
      expert:
        "The spectrum bar shows how many other managers own this player. Captaining a highly-owned player protects your rank \u2014 if he scores, everyone benefits. Captaining a low-ownership player is a differential \u2014 if he scores, you gain ground because most managers miss out. Neither approach is wrong. High ownership is safer. Low ownership is how you climb.",
      critic:
        "See that bar that says \u2018With the crowd\u2019 and \u2018Against the crowd\u2019? That\u2019s telling you whether your captain pick is the same as everyone else\u2019s. Pick the popular option and you stay level if he scores. Pick the unknown and you either rocket up the rankings or crash spectacularly. Your call. Both are valid. Only one is boring.",
      fanboy:
        "That spectrum bar is SO important! If the dot is on the LEFT (with the crowd), loads of managers benefit when he scores \u2014 safe but you won\u2019t gain ground. If the dot is on the RIGHT (against the crowd), almost NOBODY else benefits \u2014 a haul here is a RANK ROCKET! High risk, high drama!",
    },
  },
];

export const GRADUATION_CONTENT: Record<"expert" | "critic" | "fanboy", { headline: string; body: string }> = {
  expert: {
    headline: "You\u2019ve got the basics down",
    body: "Four gameweeks in and you now understand captaincy, transfers, fixtures, and ownership. Everything from here is about sharpening your edge. Your coach will still be here \u2014 I\u2019ll just talk to you like someone who knows the game.",
  },
  critic: {
    headline: "You\u2019ve got the basics down",
    body: "Four weeks. You now know more than half the managers in your mini-league. Don\u2019t let it go to your head. Actually, do \u2014 confidence helps.",
  },
  fanboy: {
    headline: "You\u2019ve got the basics down",
    body: "FOUR GAMEWEEKS COMPLETE! You basically have a degree in FPL now! The full SuperScout experience is UNLOCKED \u2014 all the data, all the tools, all the HYPE. LET\u2019S GO!",
  },
};

export const EXPLAIN_TIPS: Record<string, Record<"expert" | "critic" | "fanboy", string>> = {
  fixtures: COACHING_LESSONS[2].content,
  ownership: COACHING_LESSONS[3].content,
  confidence: {
    expert:
      "Banker is the safe pick \u2014 high floor, lower ceiling. Calculated Risk has strong data behind it but some variance. Bold Punt is the high-ceiling gamble that might blank. Choose based on your rank and how much risk you need to take.",
    critic:
      "Banker: boring but reliable. Calculated Risk: smart but not guaranteed. Bold Punt: either genius or catastrophe. Pick the one that matches how desperate your mini-league position is.",
    fanboy:
      "BANKER = safe bet, the one your nan would pick! CALCULATED RISK = smart play with some spice! BOLD PUNT = high risk HIGH REWARD \u2014 for when you need to SEND IT! \uD83D\uDE80",
  },
};
