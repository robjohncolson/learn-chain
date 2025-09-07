type pubkey = string
type privkey = string
type reputation = float
type history = list<string> // questionIds
type streak = int
type archetype = Explorers | Other // From Racket

type t = {
  userId: string,
  pubkey: pubkey,
  privkey: privkey,
  reputation: reputation,
  history: history,
  streak: streak,
  archetype: archetype,
  seedphrase: string,
  wordList: array<string>,
}

let deriveKeysFromSeed = (seed: string): (string, string) => {
  let pubkey = "pub_" ++ seed
  let privkey = "priv_" ++ seed
  (pubkey, privkey)
}

let selectRandomWords = (wordList: array<string>): string => {
  let indices = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  Belt.Array.reduce(indices, "", (acc, i) => {
    let wordListLength = Belt.Array.length(wordList)
    let word = Belt.Array.getUnsafe(wordList, mod(i, wordListLength))
    acc ++ (i == 0 ? "" : " ") ++ word
  })
}

let calculateArchetype = (transactions: list<string>): archetype => {
  Belt.List.length(transactions) > 10 ? Explorers : Other
}

let updateProfile = (profile: t, result: { "isMatch": bool, "questionId": string }): t => {
  let newStreak = result["isMatch"] ? profile.streak + 1 : 0
  let newHistory = Belt.List.add(profile.history, result["questionId"])
  let newArchetype = calculateArchetype(newHistory)
  {...profile, streak: newStreak, history: newHistory, archetype: newArchetype}
}