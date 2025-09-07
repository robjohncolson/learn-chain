module BoundedScore = {
  type t = float
  let make = (value: float): option<t> => {
    if value >= 1.0 && value <= 5.0 { Some(value) } else { None }
  }
  let unsafe_make = (value: float): t => value
  let get = (score: t): float => score
}

type txType = Attestation | APReveal | CreateUser

type transaction = {
  hash: string,
  prevHash: string,
  txType: txType,
  questionId: string,
  answerHash: option<string>,
  answerText: option<string>,
  score: option<BoundedScore.t>,
  attesterPubkey: string,
  signature: string,
  timestamp: float,
  confidence: float,
  anonymousSig: option<string>,
  nonce: int,
  isMatch: bool,
}

type attestation = {
  validatorPubkey: string,
  questionId: string,
  isMatch: bool,
  confidence: float,
  timestamp: float,
}

let sha256Hash = (input: string): string => {
  "sha256_" ++ input
}

let getCurrentTimestamp = (): float => {
  Js.Date.now()
}

let validateSignature = (_message: string, signature: string): bool => {
  Js.String.length(signature) > 0
}

let createAttestation = (validatorPubkey: string, questionId: string, answer: string, confidence: float, isMatch: bool): attestation => {
  if Js.String.length(validatorPubkey) == 0 {
    Js.Exn.raiseError("Invalid validator key")
  }
  if confidence < 0.0 || confidence > 1.0 {
    Js.Exn.raiseError("Confidence must be between 0.0 and 1.0")
  }
  let answerHash = sha256Hash(answer)
  if !validateSignature(answerHash, "dummy_signature") {
    Js.Exn.raiseError("Hash validation failed")
  }
  {validatorPubkey, questionId, isMatch, confidence, timestamp: getCurrentTimestamp()}
}

let calculateConsensus = (attests: list<attestation>): Belt.Map.String.t<float> => {
  let total = Belt.List.length(attests)
  if total == 0 {
    Belt.Map.String.empty
  } else {
    let matches = Belt.List.keep(attests, a => a.isMatch) |> Belt.List.length |> Belt.Float.fromInt
    let ratio = matches /. Belt.Float.fromInt(total)
    let avgConf = Belt.List.reduce(attests, 0., (acc, a) => acc +. a.confidence) /. Belt.Float.fromInt(total)
    let quorum = if avgConf < 0.4 { 3. } else if avgConf < 0.8 { 4. } else { 5. }
    let reached = Belt.Float.fromInt(total) >= quorum
    Belt.Map.String.fromArray([
      ("consensusReached", reached ? 1. : 0.),
      ("consensusRatio", ratio),
      ("averageConfidence", avgConf),
      ("requiredQuorum", quorum),
      ("totalAttestations", Belt.Float.fromInt(total)),
    ])
  }
}

let updateDistributions = (transactions: list<transaction>, distributions: Belt.Map.String.t<float>): Belt.Map.String.t<float> => {
  Belt.List.reduce(transactions, distributions, (acc, tx) => {
    Belt.Map.String.set(acc, tx.questionId, tx.confidence)
  })
}

let detectOutliers = (scores: list<float>): list<float> => {
  let len = Belt.List.length(scores)
  if len < 3 {
    list{}
  } else {
    let mean = Belt.List.reduce(scores, 0.0, (acc, s) => acc +. s) /. Belt.Float.fromInt(len)
    let variance = Belt.List.reduce(scores, 0.0, (acc, s) => acc +. (s -. mean) *. (s -. mean)) /. Belt.Float.fromInt(len)
    let stddev = Js.Math.sqrt(variance)
    Belt.List.keep(scores, s => Js.Math.abs_float((s -. mean) /. Js.Math.max_float(stddev, 0.001)) > 3.0)
  }
}