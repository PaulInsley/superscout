export interface TeamBanter {
  teamName: string;
  fplApiId?: number;
  stereotype: string;
  criticExample: string;
  fanboyExample: string;
}

export const TEAM_BANTER: TeamBanter[] = [
  {
    teamName: "Arsenal",
    fplApiId: 1,
    stereotype:
      'Perennial bottlers. Always fold in the title race. Fourth place trophy. "The thing about Arsenal is they always try to walk it in."',
    criticExample:
      "You're captaining Saka for the run-in? Bold. Arsenal and April collapses go together like cheese and crackers.",
    fanboyExample:
      "Arsenal are DIFFERENT this year bro. I can feel it. (Yes I said that last year. Ignore that.)",
  },
  {
    teamName: "Man United",
    fplApiId: 13,
    stereotype:
      "Fans from everywhere except Manchester. Been rebuilding since 2013. New manager, same problems.",
    criticExample:
      "United assets in FPL? Brave. That's a club that's been rebuilding longer than the Sagrada Familia.",
    fanboyExample:
      "United are DUE a purple patch bro. The law of averages HAS to kick in eventually 🔥",
  },
  {
    teamName: "Man City",
    fplApiId: 12,
    stereotype:
      'Bought success. "Any team could do it with that budget." The most expensive squad ever assembled, annually.',
    criticExample:
      "Captaining Haaland? Groundbreaking. You and every other manager who reads a teamsheet.",
    fanboyExample:
      "HAALAND IS A MACHINE. Say what you want about the budget bro but this man is BUILT DIFFERENT.",
  },
  {
    teamName: "Liverpool",
    fplApiId: 11,
    stereotype: '"This is our year." Heavy metal football. Slip references (dated but immortal).',
    criticExample:
      "Liverpool for the DGW? Makes sense. Just don't expect them to do it the easy way — they never do.",
    fanboyExample:
      "LIVERPOOL DOUBLE GAMEWEEK. Salah is about to EAT. This is genuinely their year bro. (I mean it this time.)",
  },
  {
    teamName: "Tottenham",
    fplApiId: 17,
    stereotype: 'Bottlers. "Lads, it\'s Tottenham." Trophy drought. The hope is what kills you.',
    criticExample:
      "Tripling up on Spurs? I admire the optimism. Truly. History disagrees but who am I to argue.",
    fanboyExample:
      "SPURS ARE CLICKING BRO. I know everyone's heard it before but THIS TIME it's real 🚀",
  },
  {
    teamName: "Chelsea",
    fplApiId: 4,
    stereotype:
      'Manager carousel. Squad of expensive strangers. "Spending FC." Nobody knows the best XI including the manager.',
    criticExample:
      "Chelsea assets? Which rebuild are we on now — the sixth? Good luck working out who starts.",
    fanboyExample:
      "Chelsea have SO MUCH TALENT bro. One of these weeks it clicks and EVERYONE will panic-buy their players.",
  },
  {
    teamName: "Aston Villa",
    fplApiId: 2,
    stereotype:
      "Living in the past. \"'82 European Cup winners.\" Dad won't stop mentioning it. Recently punching above their weight.",
    criticExample:
      "Villa fan backing Villa assets. The loyalty is touching. The '82 European Cup must feel like yesterday.",
    fanboyExample:
      "VILLA ARE MASSIVE. People forget they're European Cup winners bro. The heritage is REAL.",
  },
  {
    teamName: "Newcastle",
    fplApiId: 14,
    stereotype:
      'New money. Decades of pain before the takeover. Toon Army passion unmatched. "Saudi Aramco FC."',
    criticExample: "Newcastle assets? Finally a club whose spending makes City look thrifty.",
    fanboyExample: "The Toon are RISING bro. St James' Park under the lights?? NOTHING beats it 🔥",
  },
  {
    teamName: "West Ham",
    fplApiId: 19,
    stereotype:
      '"Forever blowing bubbles." Honest and slightly tragic. The odd brilliant cup run that makes everyone forget the rest.',
    criticExample: "West Ham differentials? That's a vibes-over-data bet. Respect the commitment.",
    fanboyExample:
      "West Ham are the ULTIMATE differential pick. Nobody sees it coming and that's the POINT.",
  },
  {
    teamName: "Everton",
    fplApiId: 7,
    stereotype:
      'Eternal struggle. "It\'s never dull at Goodison." The hope that kills you slowly. Scrappy survivalism.',
    criticExample:
      "Everton fan? My condolences. Let's at least make your FPL team better than your actual team.",
    fanboyExample:
      "Everton are SURVIVORS bro. That mentality transfers STRAIGHT to your FPL squad. NEVER count yourself out.",
  },
  {
    teamName: "Crystal Palace",
    fplApiId: 6,
    stereotype:
      "Giant-killers on their day. Selhurst atmosphere is different. Inconsistent but occasionally terrifying.",
    criticExample:
      "Palace assets? On their day, sure. Problem is nobody — including Palace — knows which day that is.",
    fanboyExample:
      "Selhurst Park bro. That atmosphere is DIFFERENT. Palace on a good day can beat ANYONE.",
  },
  {
    teamName: "Brighton",
    fplApiId: 3,
    stereotype:
      "The model club. Smart recruitment. Sell everyone good then replace them with someone better. Football hipster darlings.",
    criticExample:
      "Brighton fan? You probably explain expected goals at dinner parties. Fair play though — they keep getting it right.",
    fanboyExample:
      "Brighton are the SMARTEST club in the league bro. They sell a star and just FIND another one. It's literally magic.",
  },
  {
    teamName: "Fulham",
    fplApiId: 8,
    stereotype:
      "The yo-yo club. Up, down, up, down. Craven Cottage is lovely though. Quietly decent when not looking.",
    criticExample:
      "Fulham assets? Let's hope they're in a 'staying up' year. You never quite know with Fulham.",
    fanboyExample:
      "Fulham are so UNDERRATED bro. Craven Cottage is a vibe and they always have a couple of hidden FPL gems.",
  },
  {
    teamName: "Brentford",
    fplApiId: 5,
    stereotype:
      'The analytics club. Giant-killing mentality. "We\'re not supposed to be here." Everyone likes Brentford except when playing them.',
    criticExample:
      "Brentford picks? Solid. The least sexy picks in FPL that somehow always return. Very on-brand.",
    fanboyExample:
      "Brentford are the DEFINITION of punching above their weight. Everyone underestimates them and they KEEP proving people wrong 🔥",
  },
  {
    teamName: "Bournemouth",
    fplApiId: 91,
    stereotype:
      "Shouldn't really be here. Nice vibes though. The Cherries. Dangerous at home, unpredictable away.",
    criticExample:
      "Bournemouth assets? You're either a genius or mad. No in-between with the Cherries.",
    fanboyExample:
      "Bournemouth are the FUN pick bro. Nobody expects it when they turn up and that's what makes it BEAUTIFUL.",
  },
  {
    teamName: "Nottingham Forest",
    fplApiId: 15,
    stereotype:
      "European Cup winners (twice — and they'll remind you). The comeback story. Clough's ghost.",
    criticExample:
      "Forest fan? Two European Cups and they'll make sure you know about it. Let's see if they can manage a top-half finish first.",
    fanboyExample:
      "Forest are BACK where they belong bro. Two European Cups!! The history is INCREDIBLE and this squad is building something special.",
  },
  {
    teamName: "Leicester",
    fplApiId: 10,
    stereotype:
      "Fairytale that actually happened. 2016 lives forever. Everything since has been trying to recapture the magic.",
    criticExample:
      "Leicester assets? 5000-1 was a long time ago mate. Let's focus on what they're doing THIS season.",
    fanboyExample:
      "Leicester are PROOF that ANYTHING can happen in football bro. 2016 energy is ALWAYS there. Never write them off.",
  },
  {
    teamName: "Wolves",
    fplApiId: 20,
    stereotype:
      "Portuguese colony in the West Midlands. Jorge Mendes' showcase club. Counter-attacking specialists.",
    criticExample:
      "Wolves assets? If you like waiting 85 minutes for one counter-attack that somehow produces a 1-0 win, this is your club.",
    fanboyExample:
      "Wolves are DANGEROUS bro. That counter-attack hits different. One ball over the top and suddenly it's a goal.",
  },
  {
    teamName: "Southampton",
    fplApiId: 16,
    stereotype:
      "The academy. Sell everyone, produce someone better, sell them too. Plucky but heartbreaking.",
    criticExample:
      "Southampton fan? You've basically bankrolled Liverpool's squad and got a relegation battle for your trouble.",
    fanboyExample:
      "Southampton are the ultimate DEVELOPMENT club bro. Every big club wishes they had that academy 🔥",
  },
  {
    teamName: "Ipswich",
    fplApiId: 9,
    stereotype:
      "The new arrivals. Tractor Boys. Back from the wilderness. Championship fairy dust.",
    criticExample:
      "Ipswich in FPL? Welcome to the big time. Let's see if they've got any hidden gems or if it's just going to be grim.",
    fanboyExample:
      "IPSWICH ARE IN THE PREM BRO. What a journey. The Tractor Boys deserve this. Let's find some picks 🚀",
  },
];

export const PROMOTED_CLUB_TEMPLATE: Omit<TeamBanter, "teamName" | "fplApiId"> = {
  stereotype:
    "New to the party. Nobody knows their players. Potential for chaos and differentials.",
  criticExample:
    "Promoted club assets? Nobody in your mini-league will own them. That's either a masterclass or a disaster.",
  fanboyExample:
    "Promoted clubs are PURE CHAOS in FPL and that's why we LOVE them bro. Differentials EVERYWHERE.",
};

export function getTeamBanter(teamName: string): TeamBanter | null {
  return TEAM_BANTER.find((t) => t.teamName.toLowerCase() === teamName.toLowerCase()) ?? null;
}

export function getTeamBanterByFplId(fplApiId: number): TeamBanter | null {
  return TEAM_BANTER.find((t) => t.fplApiId === fplApiId) ?? null;
}
