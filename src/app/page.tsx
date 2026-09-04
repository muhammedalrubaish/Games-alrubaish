"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import styles from "./spyfall.module.css";
import { LOCATIONS_DATA } from "@/data/locations";
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
        ? `نجح الجاسوس في تخمين الموقع الصحيح وهو: ${prev.selectedLocation?.name}! 🔥`
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
        ? `صحيح! ${votedPlayer.name} كان هو الجاسوس المتسلل! تم كشفه بنجاح 🎉.`
        : `للأسف! ${votedPlayer.name} كان مواطناً بريئاً ولم يكن الجاسوس! فاز الجاسوس.`
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
          <div className={styles.logoIconImageWrapper}>
            <Image
              src="/images/app-logo.png"
              alt="شعار لعبة الجاسوس"
              width={54}
              height={54}
              className={styles.logoImage}
            />
          </div>
          <div>
            <h1 className={styles.titleMain}>لعبة الجاسوس | Spyfall</h1>
            <p className={styles.subTitle}>
              النسخة العربية الأصلية • أجواء غموض وتحقيق سايبربانك
            </p>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button
            className={styles.btnSecondary}
            onClick={() => setShowRules(!showRules)}
          >
            <span>📜</span> كيف نلعب؟
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
              <span>🔄</span> جولة جديدة
            </button>
          )}
        </div>
      </header>

      {/* Rules Box Toggle */}
      {showRules && (
        <div className={`${styles.rulesBox} fade-in-scale`}>
          <h3 className={styles.rulesTitle}>🎯 قواعد ومسار اللعبة في دقيقة:</h3>
          <ul className={styles.rulesList}>
            <li>
              📍 <strong>الجميع يعرف الموقع السري</strong> ولديهم وظائف فيه، ما
              عدا <strong>الجاسوس</strong> الذي لا يعرف أين هو إطلاقاً!
            </li>
            <li>
              ❓ يقوم أحد اللاعبين بسؤال شخص آخر سؤالاً ذكياً عن المكان (مثل: هل
              المكان بارد عادة؟ أو هل نرتدي زياً رسمياً هنا؟).
            </li>
            <li>
              🤫 <strong>قاعدة الأسئلة الذهبية:</strong> إذا سألت سؤالاً واضحاً
              جداً سيكتشف الجاسوس الموقع فوراً، وإذا سألت بغموض شديد سيشك بك
              الجميع ويعتقدون أنك الجاسوس!
            </li>
            <li>
              🏆 <strong>يفوز المحققون</strong> إذا اتفقوا وصوتوا على الجاسوس
              الحقيقي، أو <strong>يفوز الجاسوس</strong> إذا حزر الموقع الصحيح أو
              انتهى الوقت دون كشفه.
            </li>
          </ul>
        </div>
      )}

      {/* ================= STAGE 1: LOBBY ================= */}
      {gameState.status === "lobby" && (
        <>
          {/* Cinematic Hero Artwork Banner */}
          <div className={`${styles.heroBanner} fade-in-scale`}>
            <Image
              src="/images/hero-cover.jpg"
              alt="Spyfall Cover Art"
              fill
              className={styles.heroImage}
              priority
            />
            <div className={styles.heroOverlay}>
              <span className={styles.heroTag}>مهمة سرية للعملاء</span>
              <h2 className={styles.heroTitle}>من هو الجاسوس المتسلل بيننا؟</h2>
              <p className={styles.heroDesc}>
                موقع سري واحد، عملاء بريئون بهويات حقيقية، وجاسوس واحد يحاول
                التمويه والتسلل دون أن يُكشف. هل تستطيعون اكتشافه قبل فوات
                الوقت؟
              </p>
            </div>
          </div>

          <div className={`${styles.lobbyCard} fade-in-scale`}>
            <div className={styles.modeTabs}>
              <button className={`${styles.modeTab} ${styles.modeTabActive}`}>
                📱 تمرير جهاز واحد بين اللاعبين (Pass & Play)
              </button>
            </div>

            {/* Player Names Input */}
            <div className={styles.formGroup}>
              <label className={styles.label}>
                👥 أسماء اللاعبين المشاركين (3 على الأقل):
              </label>
              <form
                onSubmit={handleAddPlayer}
                style={{ display: "flex", gap: "10px" }}
              >
                <input
                  type="text"
                  className={styles.inputField}
                  placeholder="اكتب اسم اللاعب هنا واضغط إضافة..."
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  maxLength={20}
                />
                <button
                  type="submit"
                  className={styles.btnSecondary}
                  style={{
                    padding: "0 24px",
                    background: "var(--accent-cyan)",
                    color: "#05070c",
                    fontWeight: 900
                  }}
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
                  onChange={(e) =>
                    setTimerDurationMinutes(Number(e.target.value))
                  }
                >
                  <option value={5}>5 دقائق (جولة سريعة وحماسية)</option>
                  <option value={7}>7 دقائق (الوقت القياسي المثالي)</option>
                  <option value={8}>8 دقائق (للمجموعات الكبيرة)</option>
                  <option value={10}>10 دقائق (تحقيق عميق ونقاش طويل)</option>
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
                    <option value={2}>جاسوسان (تحدٍ أصعب وغامض)</option>
                  )}
                </select>
              </div>
            </div>

            <button
              className={styles.btnPrimary}
              onClick={handleStartGame}
              disabled={playerNames.length < 3}
            >
              <span>🚀</span> توزيع البطاقات السرية وبدء المهمة
            </button>
          </div>
        </>
      )}

      {/* ================= STAGE 2: CARD REVEAL ================= */}
      {gameState.status === "card-reveal" && currentPlayer && (
        <div className={`${styles.cardRevealWrapper} fade-in-scale`}>
          <p className={styles.playerPrompt}>مرّر الهاتف الآن بالسر إلى:</p>
          <h2 className={styles.playerNameHuge}>👤 {currentPlayer.name}</h2>

          {!gameState.revealedCardShowing ? (
            <div
              className={styles.secretCard}
              onClick={() => {
                SoundEffects.playReveal();
                setGameState((prev) => ({
                  ...prev,
                  revealedCardShowing: true
                }));
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
                  <Image
                    src="/images/spy-card.jpg"
                    alt="Spy Portrait"
                    width={140}
                    height={140}
                    className={styles.cardSpyImage}
                  />
                  <h3
                    className={styles.cardTitle}
                    style={{ color: "var(--accent-red)" }}
                  >
                    أنت الجاسوس! 🕵️‍♂️
                  </h3>
                  <div
                    className={styles.cardRole}
                    style={{
                      borderColor: "rgba(255, 42, 95, 0.4)",
                      background: "rgba(255, 42, 95, 0.15)",
                      color: "var(--accent-red)"
                    }}
                  >
                    المهمة: التسلل والتخفي
                  </div>
                  <p className={styles.cardHint}>
                    أنت لا تعرف الموقع السري! استمع جيداً لأسئلة وإجابات
                    الآخرين، حاول استنتاج المكان دون أن يكتشفك أحد.
                  </p>
                </>
              ) : (
                <>
                  {gameState.selectedLocation?.image ? (
                    <div
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "170px",
                        borderRadius: "var(--radius-md)",
                        overflow: "hidden",
                        marginBottom: "16px",
                        border: "1px solid var(--border-glow-cyan)",
                        boxShadow: "0 0 25px rgba(0, 242, 254, 0.3)"
                      }}
                    >
                      <Image
                        src={gameState.selectedLocation.image}
                        alt={gameState.selectedLocation.name}
                        fill
                        style={{ objectFit: "cover" }}
                        priority
                      />
                    </div>
                  ) : (
                    <div className={styles.cardIconBig}>
                      {gameState.selectedLocation?.icon}
                    </div>
                  )}
                  <h3 className={styles.cardTitle}>
                    {gameState.selectedLocation?.icon}{" "}
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
              style={{ maxWidth: "380px", marginTop: "16px" }}
              onClick={handleNextPlayerCard}
            >
              {gameState.revealedPlayerIndex + 1 < gameState.players.length
                ? "🔒 إخفاء البطاقة وتسليم للاعب التالي"
                : "🔥 الجميع رأى هويته، ابدأ التحقيق الآن!"}
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
              <div
                style={{
                  fontSize: "0.85rem",
                  color: "var(--text-secondary)",
                  fontWeight: 700
                }}
              >
                الوقت المتبقي للجولة:
              </div>
              <div
                className={`${styles.timerDisplay} ${
                  gameState.timeRemainingSeconds <= 60
                    ? styles.timerWarning
                    : ""
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
                style={{
                  background: "rgba(0, 242, 254, 0.15)",
                  color: "var(--accent-cyan)",
                  borderColor: "var(--border-glow-cyan)"
                }}
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
                border: "1px solid var(--border-glow-cyan)",
                padding: "14px 20px",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "1rem"
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>🎲</span>
              <div>
                يبدأ بطرح السؤال الأول اللاعب:{" "}
                <strong style={{ color: "var(--accent-cyan)" }}>
                  {firstQuestioner}
                </strong>{" "}
                (اختر أي لاعب واسأله سؤالاً ذكياً).
              </div>
            </div>
          )}

          {/* Locations Grid with Cross-Out feature */}
          <div>
            <div className={styles.sectionTitle}>
              <span>🗺️ قائمة الأماكن المحتملة ({LOCATIONS_DATA.length}):</span>
              <span
                style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}
              >
                (اضغط على أي موقع لشطبه أو استبعاده من الشكوك)
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
                    {loc.image ? (
                      <div className={styles.locationThumbWrapper}>
                        <Image
                          src={loc.image}
                          alt={loc.name}
                          fill
                          className={styles.locationThumbImg}
                          sizes="(max-width: 600px) 50vw, 220px"
                        />
                        <div className={styles.locationThumbOverlay} />
                      </div>
                    ) : (
                      <div
                        className={styles.locationThumbWrapper}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "2.5rem"
                        }}
                      >
                        {loc.icon}
                      </div>
                    )}

                    <div className={styles.locationContent}>
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
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "18px",
                fontSize: "0.95rem"
              }}
            >
              إذا كان تخمينك صحيحاً، ستفوز بالمباراة فوراً حتى لو كشفك
              المحققون!
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>اختر الموقع السري الذي تعتقده:</label>
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
            <p
              style={{
                color: "var(--text-secondary)",
                marginBottom: "18px",
                fontSize: "0.95rem"
              }}
            >
              اتفقوا على الشخص المشتبه به وصوتوا لإيقاف الجولة وكشف هويته:
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>من تعتقدون أنه الجاسوس؟</label>
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
        <div
          className={`${styles.lobbyCard} fade-in-scale`}
          style={{ textAlign: "center" }}
        >
          <div style={{ fontSize: "5rem", marginBottom: "14px" }}>
            {gameState.winner === "players" ? "🎉" : "🕵️‍♂️"}
          </div>

          <h2
            style={{
              fontSize: "2.4rem",
              fontWeight: 900,
              color:
                gameState.winner === "players"
                  ? "var(--accent-green)"
                  : "var(--accent-red)",
              marginBottom: "14px",
              textShadow:
                gameState.winner === "players"
                  ? "0 0 25px rgba(0, 240, 118, 0.4)"
                  : "0 0 25px rgba(255, 42, 95, 0.5)"
            }}
          >
            {gameState.winner === "players"
              ? "فوز المحققين الأذكياء!"
              : "فوز الجاسوس المتسلل!"}
          </h2>

          <p
            style={{
              fontSize: "1.2rem",
              color: "var(--text-secondary)",
              marginBottom: "28px",
              lineHeight: 1.6
            }}
          >
            {gameState.winReason}
          </p>

          {/* Reveal Location & Identities */}
          <div
            style={{
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
              marginBottom: "28px",
              textAlign: "right"
            }}
          >
            <h4 style={{ color: "var(--accent-cyan)", marginBottom: "12px", fontSize: "1.1rem" }}>
              📍 الموقع السري كان:
            </h4>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "16px",
                marginBottom: "20px",
                background: "rgba(0, 0, 0, 0.4)",
                padding: "12px 16px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-glow-cyan)"
              }}
            >
              {gameState.selectedLocation?.image && (
                <div
                  style={{
                    position: "relative",
                    width: "90px",
                    height: "60px",
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    flexShrink: 0
                  }}
                >
                  <Image
                    src={gameState.selectedLocation.image}
                    alt={gameState.selectedLocation.name}
                    fill
                    style={{ objectFit: "cover" }}
                  />
                </div>
              )}
              <div style={{ fontSize: "1.5rem", fontWeight: 900 }}>
                {gameState.selectedLocation?.icon}{" "}
                {gameState.selectedLocation?.name}
              </div>
            </div>

            <h4 style={{ color: "var(--accent-cyan)", marginBottom: "12px", fontSize: "1.1rem" }}>
              🎭 هويات اللاعبين في هذه الجولة:
            </h4>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              {gameState.players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    background: p.isSpy
                      ? "rgba(255, 42, 95, 0.15)"
                      : "rgba(255, 255, 255, 0.03)",
                    borderRadius: "var(--radius-sm)",
                    border: p.isSpy
                      ? "1px solid var(--accent-red)"
                      : "1px solid transparent"
                  }}
                >
                  <span style={{ fontWeight: 800 }}>
                    {p.name} {p.isSpy ? "🕵️‍♂️ (الجاسوس)" : ""}
                  </span>
                  <span
                    style={{
                      color: p.isSpy
                        ? "var(--accent-red)"
                        : "var(--accent-gold)",
                      fontWeight: 700
                    }}
                  >
                    {p.isSpy ? "متخفٍ بدون موقع" : p.role}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            className={styles.btnPrimary}
            onClick={handleStartGame}
            style={{ maxWidth: "360px", margin: "0 auto" }}
          >
            🎲 جولة جديدة بنفس اللاعبين
          </button>
        </div>
      )}
    </div>
  );
}
