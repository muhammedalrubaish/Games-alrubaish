"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./spyfall.module.css";
import { LOCATIONS_DATA, LocationItem } from "@/data/locations";
import { Player, GameState } from "@/types/game";
import { SoundEffects } from "@/utils/audio";

export default function SpyfallGame() {
  // Game Setup State
  const [playerNames, setPlayerNames] = useState<string[]>([
    "محمد",
    "سعد",
    "عبدالله",
    "خالد"
  ]);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [timerDurationMinutes, setTimerDurationMinutes] = useState(7);
  const [spyCount, setSpyCount] = useState(1);

  // Active Game State
  const [gameState, setGameState] = useState<GameState>({
    mode: "pass-and-play",
    status: "lobby",
    players: [],
    timerMinutes: 7,
    timeRemainingSeconds: 420,
    isTimerRunning: false,
    revealedPlayerIndex: 0,
    revealedCardShowing: false,
    crossedLocations: []
  });

  // Modals & Popups
  const [showSpyGuessModal, setShowSpyGuessModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedGuessLocation, setSelectedGuessLocation] = useState<string>("");
  const [votedPlayerId, setVotedPlayerId] = useState<string>("");
  const [showRules, setShowRules] = useState(false);
  const [firstQuestioner, setFirstQuestioner] = useState<string>("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle Add Player
  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    if (playerNames.includes(trimmed)) {
      alert("الاسم مسجل مسبقاً! اختر اسماً مختلفاً أو أضف رقماً.");
      return;
    }
    setPlayerNames([...playerNames, trimmed]);
    setNewPlayerName("");
    SoundEffects.playClick();
  };

  // Handle Remove Player
  const handleRemovePlayer = (index: number) => {
    if (playerNames.length <= 3) {
      alert("يجب أن يكون هناك 3 لاعبين على الأقل للعب!");
      return;
    }
    const updated = [...playerNames];
    updated.splice(index, 1);
    setPlayerNames(updated);
    SoundEffects.playClick();
  };

  // Start New Round / Game
  const handleStartGame = () => {
    if (playerNames.length < 3) {
      alert("الحد الأدنى للعب هو 3 لاعبين!");
      return;
    }

    // 1. Pick a random location
    const randomLocation =
      LOCATIONS_DATA[Math.floor(Math.random() * LOCATIONS_DATA.length)];

    // 2. Assign Spies randomly
    const totalPlayers = playerNames.length;
    const spyIndices = new Set<number>();
    while (spyIndices.size < Math.min(spyCount, totalPlayers - 1)) {
      spyIndices.add(Math.floor(Math.random() * totalPlayers));
    }

    // 3. Shuffle roles for citizens
    const availableRoles = [...randomLocation.roles];
    // Shuffle roles
    for (let i = availableRoles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableRoles[i], availableRoles[j]] = [
        availableRoles[j],
        availableRoles[i]
      ];
    }

    const assignedPlayers: Player[] = playerNames.map((name, index) => {
      const isSpy = spyIndices.has(index);
      const role = isSpy
        ? undefined
        : availableRoles[index % availableRoles.length];
      return {
        id: `p-${index}-${Date.now()}`,
        name,
        isSpy,
        role
      };
    });

    // Pick first player to ask question
    const randomStarter =
      assignedPlayers[Math.floor(Math.random() * assignedPlayers.length)].name;
    setFirstQuestioner(randomStarter);

    const initialSeconds = timerDurationMinutes * 60;

    setGameState({
      mode: "pass-and-play",
      status: "card-reveal",
      players: assignedPlayers,
      selectedLocation: randomLocation,
      timerMinutes: timerDurationMinutes,
      timeRemainingSeconds: initialSeconds,
      isTimerRunning: false,
      revealedPlayerIndex: 0,
      revealedCardShowing: false,
      crossedLocations: []
    });

    SoundEffects.playVictory();
  };

  // Timer Effect
  useEffect(() => {
    if (gameState.status === "playing" && gameState.isTimerRunning) {
      timerRef.current = setInterval(() => {
        setGameState((prev) => {
          if (prev.timeRemainingSeconds <= 1) {
            clearInterval(timerRef.current as NodeJS.Timeout);
            SoundEffects.playAlert();
            return {
              ...prev,
              timeRemainingSeconds: 0,
              isTimerRunning: false,
              status: "voting"
            };
          }
          if (prev.timeRemainingSeconds === 60) {
            SoundEffects.playAlert();
          }
          return {
            ...prev,
            timeRemainingSeconds: prev.timeRemainingSeconds - 1
          };
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.status, gameState.isTimerRunning]);

  // Pass card to next player in Pass & Play
  const handleNextPlayerCard = () => {
    if (gameState.revealedPlayerIndex + 1 < gameState.players.length) {
      setGameState((prev) => ({
        ...prev,
        revealedPlayerIndex: prev.revealedPlayerIndex + 1,
        revealedCardShowing: false
      }));
      SoundEffects.playClick();
    } else {
      // All players saw their cards! Start main game!
      setGameState((prev) => ({
        ...prev,
        status: "playing",
        isTimerRunning: true,
        revealedCardShowing: false
      }));
      SoundEffects.playAlert();
    }
  };

  // Toggle Cross Out Location
  const handleToggleLocationCross = (locId: string) => {
    SoundEffects.playClick();
    setGameState((prev) => {
      const exists = prev.crossedLocations.includes(locId);
      return {
        ...prev,
        crossedLocations: exists
          ? prev.crossedLocations.filter((id) => id !== locId)
          : [...prev.crossedLocations, locId]
      };
    });
  };

  // Spy Guesses Location
  const handleSpySubmitGuess = () => {
    if (!selectedGuessLocation) return;
    const isCorrect = selectedGuessLocation === gameState.selectedLocation?.id;

    setGameState((prev) => ({
      ...prev,
      isTimerRunning: false,
      status: "game-over",
      winner: isCorrect ? "spy" : "players",
      winReason: isCorrect
        ? `نجح الجاسوس في تخمين الموقع الصحيح وهو: ${prev.selectedLocation?.name}!`
        : `أخطأ الجاسوس في التخمين! الموقع الحقيقي كان: ${prev.selectedLocation?.name}.`
    }));

    setShowSpyGuessModal(false);
    if (isCorrect) {
      SoundEffects.playVictory();
    } else {
      SoundEffects.playAlert();
    }
  };

  // Players Vote on Spy
  const handleVoteSubmit = () => {
    if (!votedPlayerId) return;
    const votedPlayer = gameState.players.find((p) => p.id === votedPlayerId);
    if (!votedPlayer) return;

    const isSpy = votedPlayer.isSpy;
    setGameState((prev) => ({
      ...prev,
      isTimerRunning: false,
      status: "game-over",
      winner: isSpy ? "players" : "spy",
      winReason: isSpy
        ? `صحيح! ${votedPlayer.name} كان هو الجاسوس المتسلل! تم كشفه بنجاح.`
        : `للأسف! ${votedPlayer.name} كان بريئاً ولم يكن الجاسوس! فاز الجاسوس.`
    }));

    setShowVoteModal(false);
    if (isSpy) {
      SoundEffects.playVictory();
    } else {
      SoundEffects.playAlert();
    }
  };

  // Format MM:SS
  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const currentPlayer = gameState.players[gameState.revealedPlayerIndex];

  return (
    <div className={styles.container}>
      {/* App Header */}
      <header className={styles.header}>
        <div className={styles.logoArea}>
          <div className={styles.logoIcon}>🕵️‍♂️</div>
          <div>
            <h1 className={styles.titleMain}>لعبة الجاسوس (Spyfall)</h1>
            <p className={styles.subTitle}>
              النسخة العربية الأصلية بأماكن وأدوار حصرية
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => setShowRules(!showRules)}
          >
            📖 كيف نلعب؟
          </button>
          {gameState.status !== "lobby" && (
            <button
              className={styles.btnSecondary}
              onClick={() => {
                if (confirm("هل أنت متأكد من إنهاء الجولة والعودة للرئيسية؟")) {
                  setGameState((prev) => ({ ...prev, status: "lobby" }));
                }
              }}
            >
              🔄 جولة جديدة
            </button>
          )}
        </div>
      </header>

      {/* Rules Box Toggle */}
      {showRules && (
        <div className={`${styles.rulesBox} fade-in-scale`}>
          <h3 className={styles.rulesTitle}>🎯 قواعد اللعبة في دقيقة:</h3>
          <ul className={styles.rulesList}>
            <li>
              📍 <strong>الجميع يعرف الموقع</strong> ولديهم وظائف فيه، ما عدا{" "}
              <strong>الجاسوس</strong>!
            </li>
            <li>
              ❓ يقوم لاعب بسؤال أي شخص سؤالاً ذكياً عن المكان (مثل: هل المكان
              بارد عادة؟)، والمسؤول يجيب ثم يسأل غيره.
            </li>
            <li>
              🤫 <strong>احذر:</strong> إذا سألت سؤالاً واضحاً جداً، سيعرف
              الجاسوس المكان! وإذا سألت بغموض شديد، سيشك بك الآخرون!
            </li>
            <li>
              🏆 <strong>يفوز اللاعبون</strong> إذا كشفوا الجاسوس وصوتوا عليه، أو{" "}
              <strong>يفوز الجاسوس</strong> إذا حزر المكان أو انتهى الوقت دون
              كشفه.
            </li>
          </ul>
        </div>
      )}

      {/* ================= STAGE 1: LOBBY ================= */}
      {gameState.status === "lobby" && (
        <div className={`${styles.lobbyCard} fade-in-scale`}>
          <div className={styles.modeTabs}>
            <button className={`${styles.modeTab} ${styles.modeTabActive}`}>
              📱 جهاز واحد يمرر بين اللاعبين (Pass & Play)
            </button>
          </div>

          {/* Player Names Input */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              👥 أسماء اللاعبين (الحد الأدنى 3):
            </label>
            <form onSubmit={handleAddPlayer} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                className={styles.inputField}
                placeholder="اكتب اسم اللاعب واضغط إضافة..."
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                maxLength={20}
              />
              <button
                type="submit"
                className={styles.btnSecondary}
                style={{ padding: "0 22px", background: "var(--accent-cyan)", color: "#000", fontWeight: 700 }}
              >
                + إضافة
              </button>
            </form>

            <div className={styles.playersList}>
              {playerNames.map((name, idx) => (
                <div key={idx} className={styles.playerBadge}>
                  <span>👤 {name}</span>
                  <button
                    type="button"
                    className={styles.btnRemovePlayer}
                    onClick={() => handleRemovePlayer(idx)}
                    title="حذف اللاعب"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Game Settings */}
          <div className={styles.settingsGrid}>
            <div>
              <label className={styles.label}>⏱️ مدة الجولة:</label>
              <select
                className={styles.selectField}
                value={timerDurationMinutes}
                onChange={(e) => setTimerDurationMinutes(Number(e.target.value))}
              >
                <option value={5}>5 دقائق (سريعة وحماسية)</option>
                <option value={7}>7 دقائق (قياسية ومثالية)</option>
                <option value={8}>8 دقائق (للمجموعات الكبيرة)</option>
                <option value={10}>10 دقائق (طويلة وتحقيق عميق)</option>
              </select>
            </div>

            <div>
              <label className={styles.label}>🕵️‍♂️ عدد الجواسيس:</label>
              <select
                className={styles.selectField}
                value={spyCount}
                onChange={(e) => setSpyCount(Number(e.target.value))}
              >
                <option value={1}>جاسوس واحد (موصى به)</option>
                {playerNames.length >= 5 && (
                  <option value={2}>جاسوسان (لعبة أصعب وأكثر غموضاً)</option>
                )}
              </select>
            </div>
          </div>

          <button
            className={styles.btnPrimary}
            onClick={handleStartGame}
            disabled={playerNames.length < 3}
          >
            🚀 توزيع الأدوار وبدء الجولة
          </button>
        </div>
      )}

      {/* ================= STAGE 2: CARD REVEAL ================= */}
      {gameState.status === "card-reveal" && currentPlayer && (
        <div className={`${styles.cardRevealWrapper} fade-in-scale`}>
          <p className={styles.playerPrompt}>مرّر الهاتف الآن إلى:</p>
          <h2 className={styles.playerNameHuge}>👤 {currentPlayer.name}</h2>

          {!gameState.revealedCardShowing ? (
            <div
              className={styles.secretCard}
              onClick={() => {
                SoundEffects.playReveal();
                setGameState((prev) => ({ ...prev, revealedCardShowing: true }));
              }}
            >
              <div className={styles.cardIconBig}>🔒</div>
              <h3 className={styles.cardTitle}>اضغط لكشف بطاقتك السرية</h3>
              <p className={styles.cardHint}>
                (تأكد من عدم نظر أي شخص بجانبك إلى الشاشة!)
              </p>
            </div>
          ) : (
            <div
              className={`${styles.secretCard} ${styles.secretCardRevealed} ${
                currentPlayer.isSpy ? styles.secretCardSpy : ""
              } fade-in-scale`}
            >
              {currentPlayer.isSpy ? (
                <>
                  <div className={styles.cardIconBig}>🕵️‍♂️</div>
                  <h3 className={styles.cardTitle} style={{ color: "var(--accent-red)" }}>
                    أنت الجاسوس!
                  </h3>
                  <p className={styles.cardHint}>
                    أنت لا تعرف الموقع! استمع جيداً لأسئلة الآخرين وحاول معرفة
                    المكان دون أن يكتشفوك.
                  </p>
                </>
              ) : (
                <>
                  <div className={styles.cardIconBig}>
                    {gameState.selectedLocation?.icon}
                  </div>
                  <h3 className={styles.cardTitle}>
                    {gameState.selectedLocation?.name}
                  </h3>
                  <div className={styles.cardRole}>
                    وظيفتك: {currentPlayer.role}
                  </div>
                  <p className={styles.cardHint}>
                    {gameState.selectedLocation?.description}
                  </p>
                </>
              )}
            </div>
          )}

          {gameState.revealedCardShowing && (
            <button
              className={styles.btnPrimary}
              style={{ maxWidth: "340px", marginTop: "12px" }}
              onClick={handleNextPlayerCard}
            >
              {gameState.revealedPlayerIndex + 1 < gameState.players.length
                ? "🔒 إخفاء وتسليم للاعب التالي"
                : "🔥 الجميع رأى بطاقته، ابدأ التحقيق!"}
            </button>
          )}
        </div>
      )}

      {/* ================= STAGE 3: PLAYING DASHBOARD ================= */}
      {gameState.status === "playing" && (
        <div className={`${styles.gameDash} fade-in-scale`}>
          {/* Top Bar: Timer & Actions */}
          <div className={styles.timerBar}>
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                الوقت المتبقي:
              </div>
              <div
                className={`${styles.timerDisplay} ${
                  gameState.timeRemainingSeconds <= 60 ? styles.timerWarning : ""
                }`}
              >
                {formatTime(gameState.timeRemainingSeconds)}
              </div>
            </div>

            <div className={styles.timerControls}>
              <button
                className={styles.btnSecondary}
                onClick={() => {
                  setGameState((prev) => ({
                    ...prev,
                    isTimerRunning: !prev.isTimerRunning
                  }));
                  SoundEffects.playClick();
                }}
              >
                {gameState.isTimerRunning ? "⏸️ إيقاف مؤقت" : "▶️ استئناف"}
              </button>
              <button
                className={styles.btnDanger}
                onClick={() => setShowSpyGuessModal(true)}
              >
                🕵️‍♂️ أنا الجاسوس وأعرف المكان!
              </button>
              <button
                className={styles.btnSecondary}
                style={{ background: "rgba(0, 242, 254, 0.15)", color: "var(--accent-cyan)" }}
                onClick={() => setShowVoteModal(true)}
              >
                🗳️ تصويت على الجاسوس
              </button>
            </div>
          </div>

          {/* Question Starter Banner */}
          {firstQuestioner && (
            <div
              style={{
                background: "rgba(0, 242, 254, 0.08)",
                border: "1px solid var(--border-glow)",
                padding: "12px 18px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                fontSize: "0.95rem"
              }}
            >
              <span>🎲</span>
              <div>
                يبدأ بطرح السؤال الأول اللاعب:{" "}
                <strong style={{ color: "var(--accent-cyan)" }}>
                  {firstQuestioner}
                </strong>{" "}
                (اسأل أي لاعب من اختيارك).
              </div>
            </div>
          )}

          {/* Locations Grid with Cross-Out feature */}
          <div>
            <div className={styles.sectionTitle}>
              <span>🗺️ قائمة الأماكن المحتملة ({LOCATIONS_DATA.length}):</span>
              <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                (اضغط على أي مكان لشطبه أو استبعاده)
              </span>
            </div>

            <div className={styles.locationsGrid}>
              {LOCATIONS_DATA.map((loc) => {
                const isCrossed = gameState.crossedLocations.includes(loc.id);
                return (
                  <div
                    key={loc.id}
                    className={`${styles.locationCard} ${
                      isCrossed ? styles.locationCardCrossed : ""
                    }`}
                    onClick={() => handleToggleLocationCross(loc.id)}
                  >
                    <div className={styles.locationHeader}>
                      <span className={styles.locationIcon}>{loc.icon}</span>
                      <div>
                        <div className={styles.locationName}>{loc.name}</div>
                        <div className={styles.locationCategory}>
                          {loc.category}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: SPY GUESS LOCATION ================= */}
      {showSpyGuessModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} fade-in-scale`}>
            <h3 className={styles.modalTitle}>🕵️‍♂️ تخمين الجاسوس للموقع:</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "16px", fontSize: "0.95rem" }}>
              إذا كان تخمينك صحيحاً، ستفوز فوراً حتى لو كشفك الآخرون!
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>اختر الموقع الذي تعتقده:</label>
              <select
                className={styles.selectField}
                value={selectedGuessLocation}
                onChange={(e) => setSelectedGuessLocation(e.target.value)}
              >
                <option value="">-- اضغط لاختيار المكان --</option>
                {LOCATIONS_DATA.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.icon} {loc.name} ({loc.category})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button
                className={styles.btnPrimary}
                onClick={handleSpySubmitGuess}
                disabled={!selectedGuessLocation}
              >
                🎯 تأكيد التخمين
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => setShowSpyGuessModal(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: VOTE ON SPY ================= */}
      {showVoteModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} fade-in-scale`}>
            <h3 className={styles.modalTitle}>🗳️ التصويت لكشف الجاسوس:</h3>
            <p style={{ color: "var(--text-secondary)", marginBottom: "16px", fontSize: "0.95rem" }}>
              اتفقوا على المشتبه به وصوتوا لإيقاف الجولة وكشف الحقيقة:
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>من هو الجاسوس بنظركم؟</label>
              <select
                className={styles.selectField}
                value={votedPlayerId}
                onChange={(e) => setVotedPlayerId(e.target.value)}
              >
                <option value="">-- اختر اللاعب المشتبه به --</option>
                {gameState.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    👤 {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "24px" }}>
              <button
                className={styles.btnPrimary}
                onClick={handleVoteSubmit}
                disabled={!votedPlayerId}
              >
                🚨 كشف هوية اللاعب
              </button>
              <button
                className={styles.btnSecondary}
                onClick={() => setShowVoteModal(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STAGE 4: GAME OVER ================= */}
      {gameState.status === "game-over" && (
        <div className={`${styles.lobbyCard} fade-in-scale`} style={{ textAlign: "center" }}>
          <div style={{ fontSize: "4.5rem", marginBottom: "12px" }}>
            {gameState.winner === "players" ? "🎉" : "🕵️‍♂️"}
          </div>

          <h2
            style={{
              fontSize: "2.2rem",
              fontWeight: 900,
              color:
                gameState.winner === "players"
                  ? "var(--accent-green)"
                  : "var(--accent-red)",
              marginBottom: "12px"
            }}
          >
            {gameState.winner === "players"
              ? "فوز اللاعبين المحققين!"
              : "فوز الجاسوس المتسلل!"}
          </h2>

          <p
            style={{
              fontSize: "1.15rem",
              color: "var(--text-secondary)",
              marginBottom: "24px",
              lineHeight: 1.6
            }}
          >
            {gameState.winReason}
          </p>

          {/* Reveal Location & Identities */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-lg)",
              padding: "20px",
              marginBottom: "24px",
              textAlign: "right"
            }}
          >
            <h4 style={{ color: "var(--accent-cyan)", marginBottom: "12px" }}>
              📍 الموقع السري كان:
            </h4>
            <div style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "16px" }}>
              {gameState.selectedLocation?.icon} {gameState.selectedLocation?.name}
            </div>

            <h4 style={{ color: "var(--accent-cyan)", marginBottom: "12px" }}>
              🎭 هويات اللاعبين في هذه الجولة:
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {gameState.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: p.isSpy
                      ? "rgba(255, 51, 102, 0.15)"
                      : "rgba(255, 255, 255, 0.03)",
                    borderRadius: "var(--radius-sm)",
                    border: p.isSpy ? "1px solid var(--accent-red)" : "1px solid transparent"
                  }}
                >
                  <span style={{ fontWeight: 700 }}>
                    {p.name} {p.isSpy ? "🕵️‍♂️ (الجاسوس)" : ""}
                  </span>
                  <span style={{ color: p.isSpy ? "var(--accent-red)" : "var(--accent-gold)" }}>
                    {p.isSpy ? "مجهول" : p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className={styles.btnPrimary}
            onClick={handleStartGame}
            style={{ maxWidth: "340px", margin: "0 auto" }}
          >
            🎲 جولة جديدة بنفس اللاعبين
          </button>
        </div>
      )}
    </div>
  );
}
