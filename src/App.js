import React, { useState, useEffect, useCallback } from "react";

// --- Helper Data & Components ---

const PRESET_ARMIES = [
  {
    name: "Full Navis",
    startingForce: "2d2,2d2,2d2,2d3,2d3",
    reinforcements: "",
  },
  { name: "Pompey", startingForce: "3b3,4c2,3c3,4b3x", reinforcements: "" },
  { name: "Antony", startingForce: "2a2,3c3,3c3", reinforcements: "" },
  { name: "Caesar", startingForce: "3a3,3c3", reinforcements: "" },
  { name: "Scipio", startingForce: "2a2,3c3,3b2", reinforcements: "" },
  { name: "Narbo", startingForce: "3c2,3c2,3c4", reinforcements: "" },
  {
    name: "Narbo Pincer",
    startingForce: "3c4,3c3,3b2,3c2",
    reinforcements: "3c2,3c",
  },
];

// Collapsible Menu for Presets
const PresetLoader = ({ onLoad }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="w-full">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-all flex justify-between items-center"
      >
        <span>Load Preset Armies</span>
        <span
          className={`transform transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="bg-gray-700/50 rounded-b-lg p-4 mt-1 space-y-3 animate-fade-in">
          {PRESET_ARMIES.map((preset) => (
            <div
              key={preset.name}
              className="flex items-center justify-between p-2 bg-gray-600/50 rounded-md"
            >
              <span className="font-semibold text-white">{preset.name}</span>
              <div className="space-x-2">
                <button
                  onClick={() => onLoad(preset, "attacker")}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  Load Attacker
                </button>
                <button
                  onClick={() => onLoad(preset, "defender")}
                  className="bg-red-600 hover:bg-red-500 text-white font-bold py-1 px-3 rounded text-sm"
                >
                  Load Defender
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Parses the army string (e.g., "4D3, 2C5x") into an array of unit objects
const parseArmy = (armyString, armyName) => {
  if (!armyString.trim()) return [];
  return armyString
    .split(",")
    .map((u) => u.trim())
    .filter((u) => u)
    .map((unitStr, index) => {
      const match = unitStr.match(/^(\d)([A-D])(\d)(x?)$/i);
      if (!match) return null;
      return {
        id: `${armyName}-${unitStr}-${index}`,
        originalString: unitStr,
        strength: parseInt(match[1], 10),
        fireOrder: match[2].toUpperCase(),
        hitThreshold: parseInt(match[3], 10),
        takesDoubleDamage: match[4].toLowerCase() === "x",
        army: armyName,
      };
    })
    .filter((u) => u !== null);
};

// Rolls dice for a unit and returns the number of hits
const rollDice = (strength, hitThreshold) => {
  let hits = 0;
  for (let i = 0; i < strength; i++) {
    const roll = Math.floor(Math.random() * 6) + 1;
    if (roll <= hitThreshold) {
      hits++;
    }
  }
  return hits;
};

// Applies damage to an army, one hit at a time
const applyDamage = (army, totalHits, log) => {
  const currentArmy = [...army];
  log.push(` -> A total of ${totalHits} hit(s) will be applied one by one.`);
  for (let i = 0; i < totalHits; i++) {
    if (currentArmy.length === 0) {
      log.push(
        ` -> Remaining ${
          totalHits - i
        } hit(s) are ignored as no targets remain.`
      );
      break;
    }
    const maxStrength = Math.max(...currentArmy.map((u) => u.strength));
    const strongestUnits = currentArmy.filter(
      (u) => u.strength === maxStrength
    );
    let targetUnit;
    if (strongestUnits.length === 1) {
      targetUnit = strongestUnits[0];
    } else {
      const minHitThreshold = Math.min(
        ...strongestUnits.map((u) => u.hitThreshold)
      );
      const lowestThresholdUnits = strongestUnits.filter(
        (u) => u.hitThreshold === minHitThreshold
      );
      if (lowestThresholdUnits.length === 1) {
        targetUnit = lowestThresholdUnits[0];
      } else {
        targetUnit = [...lowestThresholdUnits].sort(
          (a, b) => b.fireOrder.charCodeAt(0) - a.fireOrder.charCodeAt(0)
        )[0];
      }
    }
    const damageToApply = targetUnit.takesDoubleDamage ? 2 : 1;
    const damageLog = targetUnit.takesDoubleDamage
      ? " [Takes Double Damage]"
      : "";
    log.push(
      ` -> Applying 1 hit to ${targetUnit.army}'s unit ${targetUnit.originalString} (Strength was: ${targetUnit.strength})${damageLog}. It takes ${damageToApply} damage.`
    );
    targetUnit.strength -= damageToApply;
    if (targetUnit.strength <= 0) {
      log.push(
        ` -> Unit ${targetUnit.originalString} from ${targetUnit.army} was eliminated.`
      );
      const index = currentArmy.findIndex((u) => u.id === targetUnit.id);
      if (index > -1) {
        currentArmy.splice(index, 1);
      }
    } else {
      log.push(
        ` -> Unit ${targetUnit.originalString} now has strength ${targetUnit.strength}.`
      );
    }
  }
  return currentArmy;
};

// Histogram Component
const Histogram = ({ title, data1, color1, label1, data2, color2, label2 }) => {
  const allBins = new Set([
    ...(data1 || []).map((d) => d.bin),
    ...(data2 || []).map((d) => d.bin),
  ]);
  const sortedBins = Array.from(allBins).sort(
    (a, b) => parseInt(a) - parseInt(b)
  );
  const maxCount = Math.max(
    ...[...(data1 || []), ...(data2 || [])].map((d) => d.count)
  );

  if (sortedBins.length === 0) return null;

  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <h3 className="text-xl font-bold mb-4 text-center text-cyan-400">
        {title}
      </h3>
      <div className="flex justify-center gap-6 mb-4">
        <div className="flex items-center">
          <div className={`w-4 h-4 rounded-full ${color1}`}></div>
          <span className="ml-2 text-sm">{label1}</span>
        </div>
        <div className="flex items-center">
          <div className={`w-4 h-4 rounded-full ${color2}`}></div>
          <span className="ml-2 text-sm">{label2}</span>
        </div>
      </div>
      <div className="space-y-3">
        {sortedBins.map((bin) => {
          const d1 = (data1 || []).find((d) => d.bin === bin);
          const d2 = (data2 || []).find((d) => d.bin === bin);
          return (
            <div key={bin} className="flex items-center gap-2 text-sm">
              <div className="w-1/4 text-right pr-2 text-gray-300">{bin}</div>
              <div className="w-3/4 bg-gray-600 rounded-lg p-1 space-y-1">
                <div
                  className={`${color1} h-5 rounded flex items-center justify-end pr-2`}
                  style={{ width: `${((d1?.count || 0) / maxCount) * 100}%` }}
                >
                  <span className="text-white font-bold text-xs">
                    {d1?.count || 0}
                  </span>
                </div>
                <div
                  className={`${color2} h-5 rounded flex items-center justify-end pr-2`}
                  style={{ width: `${((d2?.count || 0) / maxCount) * 100}%` }}
                >
                  <span className="text-white font-bold text-xs">
                    {d2?.count || 0}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [attackerArmyInput, setAttackerArmyInput] = useState("4D3, 2C5, 1A6");
  const [defenderArmyInput, setDefenderArmyInput] = useState("3B4, 3B4, 2A5");
  const [attackerReinforcementsInput, setAttackerReinforcementsInput] =
    useState("2A2, 1B1x");
  const [defenderReinforcementsInput, setDefenderReinforcementsInput] =
    useState("2C2, 2D1");

  const [simulations, setSimulations] = useState(10000);
  const [isMarsEnabled, setIsMarsEnabled] = useState(false);
  const [isAttackerRetreating, setIsAttackerRetreating] = useState(false);
  const [isDefenderRetreating, setIsDefenderRetreating] = useState(false);
  const [results, setResults] = useState(null);
  const [histogramData, setHistogramData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState([]);

  const runSingleGame = useCallback(
    (
      initialAttackerArmy,
      initialDefenderArmy,
      initialAttackerReinforcements,
      initialDefenderReinforcements,
      marsEnabled,
      attackerRetreat,
      defenderRetreat
    ) => {
      let attackerArmy = JSON.parse(JSON.stringify(initialAttackerArmy));
      let defenderArmy = JSON.parse(JSON.stringify(initialDefenderArmy));
      let attackerReinforcements = JSON.parse(
        JSON.stringify(initialAttackerReinforcements)
      );
      let defenderReinforcements = JSON.parse(
        JSON.stringify(initialDefenderReinforcements)
      );
      const log = [];
      const fireOrders = ["A", "B", "C", "D"];
      const totalRounds = 4;

      let attackerRetreatedStrength = 0;
      let defenderRetreatedStrength = 0;
      let attackerDamageDealt = 0;
      let defenderDamageDealt = 0;

      for (let round = 1; round <= totalRounds; round++) {
        log.push(`\n--- Round ${round} ---`);
        if (round === 1 && marsEnabled) {
          log.push(
            `\n-- Mars Rule Active for Round 1: All Attackers fire first! --`
          );
          let totalAttackerHits = 0;
          attackerArmy.forEach((unit) => {
            const hits = rollDice(unit.strength, unit.hitThreshold);
            log.push(
              `Attacker's ${unit.originalString} (S:${unit.strength}) fires and scores ${hits} hit(s).`
            );
            totalAttackerHits += hits;
          });
          if (totalAttackerHits > 0) {
            attackerDamageDealt += totalAttackerHits;
            defenderArmy = applyDamage(defenderArmy, totalAttackerHits, log);
          }
          if (defenderArmy.length > 0) {
            let totalDefenderHits = 0;
            defenderArmy.forEach((unit) => {
              const hits = rollDice(unit.strength, unit.hitThreshold);
              log.push(
                `Defender's ${unit.originalString} (S:${unit.strength}) fires and scores ${hits} hit(s).`
              );
              totalDefenderHits += hits;
            });
            if (totalDefenderHits > 0) {
              defenderDamageDealt += totalDefenderHits;
              attackerArmy = applyDamage(attackerArmy, totalDefenderHits, log);
            }
          } else {
            log.push(
              "Defender's army was eliminated before they could fire back."
            );
          }
          continue;
        }
        if (round === 2) {
          log.push(`\n-- Reinforcement Phase --`);
          if (initialAttackerArmy.length > 0 && attackerArmy.length === 0) {
            log.push(
              "Attacker's starting force was eliminated! Reinforcements lose 1 strength."
            );
            attackerReinforcements.forEach(
              (u) => (u.strength = Math.max(1, u.strength - 1))
            );
          }
          if (initialDefenderArmy.length > 0 && defenderArmy.length === 0) {
            log.push(
              "Defender's starting force was eliminated! Reinforcements lose 1 strength."
            );
            defenderReinforcements.forEach(
              (u) => (u.strength = Math.max(1, u.strength - 1))
            );
          }
          log.push("Reinforcements are now joining the battle.");
          attackerArmy.push(...attackerReinforcements);
          defenderArmy.push(...defenderReinforcements);
        }
        if (!attackerArmy.length || !defenderArmy.length) {
          log.push("One side has no forces, ending combat for this round.");
          continue;
        }
        for (const order of fireOrders) {
          if (!attackerArmy.length || !defenderArmy.length) break;
          const defenderFiringUnits = defenderArmy.filter(
            (u) => u.fireOrder === order
          );
          const attackerFiringUnits = attackerArmy.filter(
            (u) => u.fireOrder === order
          );
          if (
            defenderFiringUnits.length === 0 &&
            attackerFiringUnits.length === 0
          )
            continue;
          log.push(`\n-- Firing Phase: ${order} --`);
          if (
            round === 2 &&
            defenderRetreat &&
            defenderFiringUnits.length > 0
          ) {
            log.push(`Defender's units in phase ${order} are retreating!`);
            defenderRetreatedStrength += defenderFiringUnits.reduce(
              (sum, u) => sum + u.strength,
              0
            );
            const retreatingIds = defenderFiringUnits.map((u) => u.id);
            defenderArmy = defenderArmy.filter(
              (u) => !retreatingIds.includes(u.id)
            );
          } else {
            let defenderHits = 0;
            defenderFiringUnits.forEach((unit) => {
              const hits = rollDice(unit.strength, unit.hitThreshold);
              log.push(
                `Defender's ${unit.originalString} (S:${unit.strength}) fires and scores ${hits} hit(s).`
              );
              defenderHits += hits;
            });
            if (defenderHits > 0) {
              defenderDamageDealt += defenderHits;
              attackerArmy = applyDamage(attackerArmy, defenderHits, log);
            }
          }
          if (
            (round === 2 &&
              attackerRetreat &&
              attackerFiringUnits.length > 0) ||
            (round === 4 && attackerFiringUnits.length > 0)
          ) {
            log.push(
              `Attacker's units in phase ${order} are making a mandatory retreat!`
            );
            attackerRetreatedStrength += attackerFiringUnits.reduce(
              (sum, u) => sum + u.strength,
              0
            );
            const retreatingIds = attackerFiringUnits.map((u) => u.id);
            attackerArmy = attackerArmy.filter(
              (u) => !retreatingIds.includes(u.id)
            );
          } else {
            let attackerHits = 0;
            attackerFiringUnits.forEach((unit) => {
              const hits = rollDice(unit.strength, unit.hitThreshold);
              log.push(
                `Attacker's ${unit.originalString} (S:${unit.strength}) fires and scores ${hits} hit(s).`
              );
              attackerHits += hits;
            });
            if (attackerHits > 0) {
              attackerDamageDealt += attackerHits;
              defenderArmy = applyDamage(defenderArmy, attackerHits, log);
            }
          }
        }
      }
      const finalAttackerStrength =
        attackerArmy.reduce((sum, u) => sum + u.strength, 0) +
        attackerRetreatedStrength;
      const finalDefenderStrength =
        defenderArmy.reduce((sum, u) => sum + u.strength, 0) +
        defenderRetreatedStrength;
      log.push("\n--- Game Over ---");
      log.push(
        `Final Attacker Strength (including retreated): ${finalAttackerStrength}`
      );
      log.push(
        `Final Defender Strength (including retreated): ${finalDefenderStrength}`
      );
      let winner, resultText;
      if (finalAttackerStrength > 0 && finalDefenderStrength === 0) {
        winner = "attacker_wipeout";
        resultText = "Attacker Total Victory (Wipeout)";
      } else if (finalDefenderStrength > 0 && finalAttackerStrength === 0) {
        winner = "defender_wipeout";
        resultText = "Defender Total Victory (Wipeout)";
      } else if (finalAttackerStrength > finalDefenderStrength) {
        winner = "attacker_marginal";
        resultText = "Attacker Marginal Victory";
      } else if (finalDefenderStrength > finalAttackerStrength) {
        winner = "defender_marginal";
        resultText = "Defender Marginal Victory";
      } else {
        winner = "draw";
        resultText = "Draw";
      }
      log.push(`Result: ${resultText}`);
      return {
        winner,
        log,
        attackerRetreatedStrength,
        defenderRetreatedStrength,
        finalAttackerStrength,
        finalDefenderStrength,
        attackerDamageDealt,
        defenderDamageDealt,
      };
    },
    []
  );

  const createHistogramData = (data, binSize = 1) => {
    if (data.length === 0) return [];
    const maxVal = Math.max(...data);
    const bins = {};
    const binCount = Math.ceil(maxVal / binSize) + 1;
    for (let i = 0; i < binCount; i++) {
      const binName = `${i * binSize}`;
      bins[binName] = 0;
    }
    data.forEach((val) => {
      const binIndex = Math.floor(val / binSize);
      const binName = `${binIndex * binSize}`;
      if (bins[binName] !== undefined) {
        bins[binName]++;
      } else if (val === 0) {
        bins["0"]++;
      }
    });
    return Object.entries(bins)
      .map(([bin, count]) => ({ bin, count }))
      .filter((b) => b.count > 0 || b.bin === "0");
  };

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setResults(null);
    setHistogramData(null);
    const initialAttackerArmy = parseArmy(attackerArmyInput, "Attacker");
    const initialDefenderArmy = parseArmy(defenderArmyInput, "Defender");
    const initialAttackerReinforcements = parseArmy(
      attackerReinforcementsInput,
      "Attacker Reinforcement"
    );
    const initialDefenderReinforcements = parseArmy(
      defenderReinforcementsInput,
      "Defender Reinforcement"
    );
    const gameParams = [
      initialAttackerArmy,
      initialDefenderArmy,
      initialAttackerReinforcements,
      initialDefenderReinforcements,
      isMarsEnabled,
      isAttackerRetreating,
      isDefenderRetreating,
    ];
    const singleGameResult = runSingleGame(...gameParams);
    setSimulationLog(singleGameResult.log);
    setTimeout(() => {
      let wins = {
        attacker_wipeout: 0,
        defender_wipeout: 0,
        attacker_marginal: 0,
        defender_marginal: 0,
        draw: 0,
      };
      let totalAttackerRetreatedStrength = 0,
        totalDefenderRetreatedStrength = 0;
      let totalAttackerDamage = 0,
        totalDefenderDamage = 0;
      const attackerStrengthResults = [],
        defenderStrengthResults = [],
        attackerDamageResults = [],
        defenderDamageResults = [];

      for (let i = 0; i < simulations; i++) {
        const result = runSingleGame(...gameParams);
        wins[result.winner]++;
        totalAttackerRetreatedStrength += result.attackerRetreatedStrength;
        totalDefenderRetreatedStrength += result.defenderRetreatedStrength;
        totalAttackerDamage += result.attackerDamageDealt;
        totalDefenderDamage += result.defenderDamageDealt;
        attackerStrengthResults.push(result.finalAttackerStrength);
        defenderStrengthResults.push(result.finalDefenderStrength);
        attackerDamageResults.push(result.attackerDamageDealt);
        defenderDamageResults.push(result.defenderDamageDealt);
      }
      setResults({
        attackerWipeout: (wins.attacker_wipeout / simulations) * 100,
        defenderWipeout: (wins.defender_wipeout / simulations) * 100,
        attackerMarginal: (wins.attacker_marginal / simulations) * 100,
        defenderMarginal: (wins.defender_marginal / simulations) * 100,
        draw: (wins.draw / simulations) * 100,
        avgAttackerRetreatedStrength:
          totalAttackerRetreatedStrength / simulations,
        avgDefenderRetreatedStrength:
          totalDefenderRetreatedStrength / simulations,
        avgAttackerDamage: totalAttackerDamage / simulations,
        avgDefenderDamage: totalDefenderDamage / simulations,
      });
      setHistogramData({
        attackerStrength: createHistogramData(attackerStrengthResults),
        defenderStrength: createHistogramData(defenderStrengthResults),
        attackerDamage: createHistogramData(attackerDamageResults),
        defenderDamage: createHistogramData(defenderDamageResults),
      });
      setIsSimulating(false);
    }, 100);
  };

  const handleClearInputs = () => {
    setAttackerArmyInput("");
    setDefenderArmyInput("");
    setAttackerReinforcementsInput("");
    setDefenderReinforcementsInput("");
    setResults(null);
    setSimulationLog([]);
    setHistogramData(null);
  };

  const handleSaveInputs = () => {
    const inputsToSave = {
      attacker: attackerArmyInput,
      defender: defenderArmyInput,
      attackerReinforcements: attackerReinforcementsInput,
      defenderReinforcements: defenderReinforcementsInput,
    };
    localStorage.setItem(
      "wargameCalculatorInputs",
      JSON.stringify(inputsToSave)
    );
    alert("Armies saved!");
  };

  const handleLoadInputs = () => {
    const saved = localStorage.getItem("wargameCalculatorInputs");
    if (saved) {
      const parsed = JSON.parse(saved);
      setAttackerArmyInput(parsed.attacker || "");
      setDefenderArmyInput(parsed.defender || "");
      setAttackerReinforcementsInput(parsed.attackerReinforcements || "");
      setDefenderReinforcementsInput(parsed.defenderReinforcements || "");
      alert("Armies loaded!");
    } else {
      alert("No saved armies found.");
    }
  };

  const handleFlipInputs = () => {
    setAttackerArmyInput(defenderArmyInput);
    setDefenderArmyInput(attackerArmyInput);
    setAttackerReinforcementsInput(defenderReinforcementsInput);
    setDefenderReinforcementsInput(attackerReinforcementsInput);
  };

  const handleLoadPreset = (preset, side) => {
    if (side === "attacker") {
      setAttackerArmyInput(preset.startingForce);
      setAttackerReinforcementsInput(preset.reinforcements);
    } else {
      setDefenderArmyInput(preset.startingForce);
      setDefenderReinforcementsInput(preset.reinforcements);
    }
  };

  return (
    <div className="bg-gray-900 text-white min-h-screen font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-cyan-400">
            Wargame Monte Carlo Calculator
          </h1>
          <p className="text-gray-400 mt-2">
            Simulate block wargame outcomes with reinforcements and special
            rules.
          </p>
        </header>
        <div className="bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="attacker-army"
                  className="block text-lg font-semibold mb-2 text-green-400"
                >
                  Attacker Starting Force
                </label>
                <input
                  id="attacker-army"
                  type="text"
                  value={attackerArmyInput}
                  onChange={(e) => setAttackerArmyInput(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:outline-none transition"
                  placeholder="e.g., 4D3, 2C5"
                />
              </div>
              <div>
                <label
                  htmlFor="attacker-reinforcements"
                  className="block text-lg font-semibold mb-2 text-green-300"
                >
                  Attacker Reinforcements
                </label>
                <input
                  id="attacker-reinforcements"
                  type="text"
                  value={attackerReinforcementsInput}
                  onChange={(e) =>
                    setAttackerReinforcementsInput(e.target.value)
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:outline-none transition"
                  placeholder="e.g., 2A2, 1B1x"
                />
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="defender-army"
                  className="block text-lg font-semibold mb-2 text-red-400"
                >
                  Defender Starting Force
                </label>
                <input
                  id="defender-army"
                  type="text"
                  value={defenderArmyInput}
                  onChange={(e) => setDefenderArmyInput(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:outline-none transition"
                  placeholder="e.g., 3B4, 2A5"
                />
              </div>
              <div>
                <label
                  htmlFor="defender-reinforcements"
                  className="block text-lg font-semibold mb-2 text-red-300"
                >
                  Defender Reinforcements
                </label>
                <input
                  id="defender-reinforcements"
                  type="text"
                  value={defenderReinforcementsInput}
                  onChange={(e) =>
                    setDefenderReinforcementsInput(e.target.value)
                  }
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-red-500 focus:outline-none transition"
                  placeholder="e.g., 2C2, 2D1"
                />
              </div>
            </div>
          </div>
          <div className="mt-6 border-t border-gray-700 pt-6">
            <PresetLoader onLoad={handleLoadPreset} />
          </div>
          <div className="mt-6 border-t border-gray-700 pt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <label
                htmlFor="simulations"
                className="block text-lg font-semibold mb-2 text-cyan-400"
              >
                Simulations
              </label>
              <input
                id="simulations"
                type="number"
                value={simulations}
                onChange={(e) =>
                  setSimulations(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-full md:w-48 bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition"
              />
            </div>
            <div className="flex items-center pt-8 gap-x-8">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="mars-rule"
                  checked={isMarsEnabled}
                  onChange={(e) => setIsMarsEnabled(e.target.checked)}
                  className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-cyan-500 focus:ring-cyan-500"
                />
                <label
                  htmlFor="mars-rule"
                  className="ml-3 text-lg font-semibold text-cyan-400"
                >
                  Mars Rule
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="attacker-retreat"
                  checked={isAttackerRetreating}
                  onChange={(e) => setIsAttackerRetreating(e.target.checked)}
                  className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-green-500 focus:ring-green-500"
                />
                <label
                  htmlFor="attacker-retreat"
                  className="ml-3 text-lg font-semibold text-green-400"
                >
                  Attacker Retreat (R2)
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="defender-retreat"
                  checked={isDefenderRetreating}
                  onChange={(e) => setIsDefenderRetreating(e.target.checked)}
                  className="h-5 w-5 bg-gray-700 border-gray-600 rounded text-red-500 focus:ring-red-500"
                />
                <label
                  htmlFor="defender-retreat"
                  className="ml-3 text-lg font-semibold text-red-400"
                >
                  Defender Retreat (R2)
                </label>
              </div>
            </div>
          </div>
          <div className="mt-8 text-center flex justify-center flex-wrap gap-4">
            <button
              onClick={handleRunSimulation}
              disabled={isSimulating}
              className="bg-cyan-500 hover:bg-cyan-600 text-gray-900 font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:scale-100"
            >
              {isSimulating ? "Simulating..." : "Run Simulation"}
            </button>
            <button
              onClick={handleFlipInputs}
              disabled={isSimulating}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:scale-100"
            >
              Flip Armies
            </button>
            <button
              onClick={handleSaveInputs}
              disabled={isSimulating}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:scale-100"
            >
              Save Armies
            </button>
            <button
              onClick={handleLoadInputs}
              disabled={isSimulating}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:scale-100"
            >
              Load Armies
            </button>
            <button
              onClick={handleClearInputs}
              disabled={isSimulating}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg text-lg transition-transform transform hover:scale-105 disabled:bg-gray-700 disabled:cursor-not-allowed disabled:scale-100"
            >
              Clear Inputs
            </button>
          </div>
        </div>
        {isSimulating && (
          <div className="text-center p-8">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-cyan-400 mx-auto"></div>
            <p className="mt-4 text-lg">
              Running {simulations.toLocaleString()} simulations...
            </p>
          </div>
        )}
        {results && (
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 mb-8 animate-fade-in">
            <h2 className="text-2xl font-bold text-center mb-6 text-cyan-400">
              Simulation Results
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div className="bg-gray-700/50 rounded-lg p-4 flex flex-col">
                <h3 className="text-xl font-bold text-green-400 mb-2">
                  Attacker Wins
                </h3>
                <p className="text-4xl font-bold mt-auto">
                  {(results.attackerMarginal + results.attackerWipeout).toFixed(
                    2
                  )}
                  %
                </p>
                <div className="mt-4 space-y-2 text-sm text-left text-gray-300 border-t border-gray-600 pt-2">
                  <p>
                    Wipeout:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.attackerWipeout.toFixed(2)}%
                    </span>
                  </p>
                  <p>
                    Marginal:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.attackerMarginal.toFixed(2)}%
                    </span>
                  </p>
                  <p>
                    Avg. Strength Retreated:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.avgAttackerRetreatedStrength.toFixed(2)}
                    </span>
                  </p>
                  <p>
                    Avg. Damage Dealt:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.avgAttackerDamage.toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 flex flex-col">
                <h3 className="text-xl font-bold text-yellow-400 mb-2">
                  Draws
                </h3>
                <p className="text-4xl font-bold mt-auto">
                  {results.draw.toFixed(2)}%
                </p>
              </div>
              <div className="bg-gray-700/50 rounded-lg p-4 flex flex-col">
                <h3 className="text-xl font-bold text-red-400 mb-2">
                  Defender Wins
                </h3>
                <p className="text-4xl font-bold mt-auto">
                  {(results.defenderMarginal + results.defenderWipeout).toFixed(
                    2
                  )}
                  %
                </p>
                <div className="mt-4 space-y-2 text-sm text-left text-gray-300 border-t border-gray-600 pt-2">
                  <p>
                    Wipeout:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.defenderWipeout.toFixed(2)}%
                    </span>
                  </p>
                  <p>
                    Marginal:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.defenderMarginal.toFixed(2)}%
                    </span>
                  </p>
                  <p>
                    Avg. Strength Retreated:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.avgDefenderRetreatedStrength.toFixed(2)}
                    </span>
                  </p>
                  <p>
                    Avg. Damage Dealt:{" "}
                    <span className="font-semibold text-white float-right">
                      {results.avgDefenderDamage.toFixed(2)}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        {simulationLog.length > 0 && (
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">
              Single Battle Log
            </h2>
            <pre className="bg-gray-900 rounded-lg p-4 h-96 overflow-y-auto text-sm font-mono whitespace-pre-wrap">
              {simulationLog.join("\n")}
            </pre>
          </div>
        )}
        {histogramData && (
          <div className="bg-gray-800 rounded-2xl shadow-lg p-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-center mb-6 text-cyan-400">
              Result Histograms
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Histogram
                title="Final Strength Distribution"
                data1={histogramData.attackerStrength}
                color1="bg-green-500"
                label1="Attacker"
                data2={histogramData.defenderStrength}
                color2="bg-red-500"
                label2="Defender"
              />
              <Histogram
                title="Damage Dealt Distribution"
                data1={histogramData.attackerDamage}
                color1="bg-green-500"
                label1="Attacker"
                data2={histogramData.defenderDamage}
                color2="bg-red-500"
                label2="Defender"
              />
            </div>
          </div>
        )}
      </div>
      <style>{`@keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } .animate-fade-in { animation: fade-in 0.5s ease-out forwards; }`}</style>
    </div>
  );
}
