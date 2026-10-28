// Party combat (all four Horsemen ride together). Pure data: AI behaviour per Horseman and the
// selectable AI styles. Companions use the SAME weapons, skills, cooldowns and damage rules as the
// player (PartySystem runs them through the normal systems); these numbers only steer decisions.

// Per-class behaviour.
//   role        frontline | ranged | control | execute     (shown in the party panel)
//   keepAway    preferred minimum distance from a melee foe (ranged keeps 2+ cells away)
//   prefer      target weights (lower score = preferred): see CompanionAI._score
//   skills      skill ids in the order the AI tries them, with simple conditions
//               when: 'always' | 'adjacent' | 'multi' (2+ foes near) | 'hurt' (own HP < 50%)
//                     | 'lowTarget' (target HP < 35%) | 'notStatus:<id>' (target lacks a status)
//   guardAt     guard against an incoming wind-up when own HP fraction is below this
//   retreatAt   back away towards the controlled Horseman below this HP fraction
export const COMPANION_AI = {
  conquest: {
    role: 'ranged', keepAway: 2,
    prefer: { marked: -2.5, vulnerable: -1.5, lowHp: -1, elite: -0.5, attackingLeader: -2 },
    skills: [
      { id: 'world_conqueror', when: 'multi' },
      { id: 'mark_of_crown', when: 'notStatus:mark' },
      { id: 'piercing_judgment', when: 'always' },
      { id: 'royal_decree', when: 'always' },
      { id: 'phantom_volley', when: 'always' },
    ],
    guardAt: 0.5, retreatAt: 0.35,
  },
  war: {
    role: 'frontline', keepAway: 0,
    prefer: { nearest: -1, elite: -1, attackingLeader: -2.5 },
    skills: [
      { id: 'red_apocalypse', when: 'multi' },
      { id: 'blood_rush', when: 'adjacent' },
      { id: 'cleave', when: 'multi' },
      { id: 'armor_breaker', when: 'adjacent' },
      { id: 'earthshaker', when: 'multi' },
    ],
    guardAt: 0.3, retreatAt: 0.18,
  },
  famine: {
    role: 'control', keepAway: 1,
    prefer: { notWithered: -1.5, elite: -1, attackingLeader: -2 },
    skills: [
      { id: 'last_harvest', when: 'multi' },
      { id: 'withering_touch', when: 'notStatus:wither' },
      { id: 'harvest_of_weakness', when: 'hurt' },
      { id: 'black_plague', when: 'always' },
      { id: 'starvation_field', when: 'multi' },
    ],
    guardAt: 0.55, retreatAt: 0.4,
  },
  death: {
    role: 'execute', keepAway: 0,
    prefer: { lowHp: -3, elite: -1.5, graveMarked: -1, attackingLeader: -2 },
    skills: [
      { id: 'final_silence', when: 'lowTarget' },
      { id: 'grave_mark', when: 'notStatus:grave_mark' },
      { id: 'wraith_step', when: 'hurt' },
      { id: 'soul_rend', when: 'always' },
      { id: 'deaths_embrace', when: 'lowTarget' },
    ],
    guardAt: 0.4, retreatAt: 0.25,
  },
};

// OPTIONS -> AI STYLE. think: seconds between decisions (reaction time); spread: penalty per ally
// already on a target (target distribution); skillGap: minimum seconds between a companion's casts;
// guardMult / retreatMult scale the per-class thresholds above.
export const AI_STYLES = {
  balanced: { label: 'BALANCED', think: 0.25, spread: 2, skillGap: 2.0, guardMult: 1, retreatMult: 1 },
  aggressive: { label: 'AGGRESSIVE', think: 0.15, spread: 1, skillGap: 1.2, guardMult: 0.5, retreatMult: 0.5 },
  cautious: { label: 'CAUTIOUS', think: 0.35, spread: 3, skillGap: 3.0, guardMult: 1.5, retreatMult: 1.5 },
};

export const PARTY_TUNING = {
  detectRange: 7,      // companions notice foes this close (with line of sight) to them or to the leader
  leash: 12,           // farther than this from the leader -> catch up (teleport behind) if no path
  stuckTime: 3,        // seconds without progress before a companion catches up
  unreachableFor: 2.5, // seconds a target with no path is ignored by that companion
  reviveFrac: 0.3,     // fallen companions get up with this HP fraction on the next floor
  trail: 6,            // leader positions remembered for formation following
};
