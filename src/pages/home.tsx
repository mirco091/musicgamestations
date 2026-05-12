import React, { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { SiX } from 'react-icons/si';
import { Copy, Music, Gamepad2, Disc, Play, Pause, Coins, Sparkles, ChevronDown } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import ParticleBackground from '@/components/ParticleBackground';
import RhythmGame from '@/components/RhythmGame';

const CONTRACT_ADDRESS = "HGNjaczVcV6tKbpWCLarszbwtwB9hUd2Cd7ySbabpump";

const fadeIn = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut" as const } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2 }
  }
};

const tracks = [
  { title: "replay", subtitle: "Chapter 01: Awakening", src: "/music/replay.mp3" },
];

function MusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) { a.pause(); setIsPlaying(false); }
    else { a.play(); setIsPlaying(true); }
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onTime = () => {
      setCurrentTime(a.currentTime);
      setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
    };
    const onMeta = () => setDuration(a.duration);
    const onEnd = () => setIsPlaying(false);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !a.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    a.currentTime = ratio * a.duration;
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full bg-black/40 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-[0_0_30px_rgba(168,85,247,0.15)]">
      <audio ref={audioRef} src={tracks[0].src} preload="metadata" />
      <div className="flex items-center gap-4 mb-5">
        <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-primary/40 to-secondary/40 flex items-center justify-center border border-white/10 shrink-0 shadow-[0_0_15px_rgba(236,72,153,0.3)]">
          <Music className="w-6 h-6 text-white/80" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-serif font-bold text-white truncate text-lg">{tracks[0].title}</div>
          <div className="font-jp text-xs text-primary/70 mt-0.5">{tracks[0].subtitle}</div>
        </div>
        <button
          onClick={toggle}
          data-testid="button-play-toggle"
          className="w-12 h-12 rounded-full bg-secondary/20 hover:bg-secondary/40 border border-secondary/40 flex items-center justify-center transition-all hover:shadow-[0_0_20px_rgba(236,72,153,0.4)] shrink-0"
        >
          {isPlaying
            ? <Pause className="w-5 h-5 text-secondary fill-secondary" />
            : <Play className="w-5 h-5 ml-0.5 text-secondary fill-secondary" />}
        </button>
      </div>
      <div
        className="h-1.5 bg-white/10 rounded-full cursor-pointer group mb-2"
        onClick={seek}
        data-testid="player-seekbar"
      >
        <div
          className="h-full bg-gradient-to-r from-primary to-secondary rounded-full relative transition-all"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-[0_0_8px_rgba(236,72,153,0.8)]" />
        </div>
      </div>
      <div className="flex justify-between text-xs text-white/40 font-mono">
        <span>{fmt(currentTime)}</span>
        <span>{duration ? fmt(duration) : '--:--'}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const { toast } = useToast();
  const heroRef = useRef<HTMLDivElement>(null);
  const [gameOpen, setGameOpen] = useState(false);
  
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"]
  });

  const yHero = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacityHero = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    toast({
      title: "Contract Address Copied",
      description: "Added to clipboard. Keep the rhythm going.",
    });
  };

  return (
    <div className="relative min-h-screen w-full bg-background text-foreground selection:bg-secondary/30">
      <ParticleBackground />
      {gameOpen && <RhythmGame onClose={() => setGameOpen(false)} />}
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between p-6 mix-blend-difference">
        <div className="font-serif font-bold text-xl tracking-widest text-glow">MIRCO</div>
        <div className="flex gap-4">
          <Button variant="ghost" size="icon" asChild className="hover:text-secondary transition-colors">
            <a href="https://twitter.com/aoiao901" target="_blank" rel="noreferrer">
              <SiX className="w-5 h-5" />
            </a>
          </Button>
          <Button className="bg-secondary hover:bg-secondary/80 text-white rounded-full px-6 shadow-[0_0_15px_rgba(236,72,153,0.5)] font-bold tracking-wider" asChild>
            <a href="#play">PLAY NOW</a>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} className="relative h-screen w-full flex items-center justify-center overflow-hidden">
        <motion.div 
          className="absolute inset-0 z-0"
          style={{ y: yHero, opacity: opacityHero }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-10" />
          <img 
            src="/mirco-hero.png" 
            alt="Mirco Character" 
            className="w-full h-full object-cover object-center mix-blend-lighten opacity-80"
          />
        </motion.div>

        <div className="relative z-10 flex flex-col items-center text-center px-4 max-w-4xl mt-20">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          >
            <div className="font-jp text-secondary/80 text-xl md:text-2xl mb-4 tracking-[0.3em]">ミルコ・リズム・プロジェクト</div>
            <h1 className="text-6xl md:text-8xl font-serif font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white via-pink-200 to-primary text-glow-pink">
              MIRCO RHYTHM<br/>PROJECT
            </h1>
            <p className="text-xl md:text-2xl text-white/80 font-light max-w-2xl mx-auto mb-10 leading-relaxed drop-shadow-lg">
              A songstress who lost her memories reclaims her story through music.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-6"
          >
            <Button size="lg" className="bg-primary hover:bg-primary/80 text-white rounded-full px-8 py-6 text-lg glow-primary shadow-[0_0_30px_rgba(168,85,247,0.4)]" asChild>
              <a href="#play">
                <Play className="mr-2 w-5 h-5 fill-current" /> Enter the Stage
              </a>
            </Button>
            <Button size="lg" variant="outline" className="border-secondary/50 text-secondary hover:bg-secondary/10 rounded-full px-8 py-6 text-lg backdrop-blur-sm" asChild>
              <a href="#token">
                <Coins className="mr-2 w-5 h-5" /> Explore Token
              </a>
            </Button>
          </motion.div>
        </div>

        <motion.div 
          className="absolute bottom-10 left-1/2 -translate-x-1/2 text-white/50"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-8 h-8" />
        </motion.div>
      </section>

      {/* Concept Section */}
      <section className="py-32 px-6 relative z-10 bg-background/90 backdrop-blur-xl border-t border-white/5">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div 
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeIn}
          >
            <h2 className="text-4xl md:text-5xl font-serif mb-8 text-glow">
              <span className="block font-jp text-primary/60 text-lg mb-2 tracking-widest">失われた記憶</span>
              Lost Memories, Found Melodies
            </h2>
            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-3xl mx-auto">
              In a world where memories fade like echoes, Mirco sings to remember. Every beat, every token, and every player brings her closer to uncovering who she truly is. This is not just a game; it is an emotional journey powered by you.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Four Pillars */}
      <section className="py-32 px-6 relative z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto">
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12"
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
          >
            {[
              { icon: Music, title: "Original Music", jp: "オリジナル楽曲", desc: "Soul-stirring J-POP and anime-style theme songs crafted for emotional impact.", color: "text-secondary" },
              { icon: Sparkles, title: "Anime Story", jp: "アニメストーリー", desc: "Unlock narrative chapters as you progress, collecting memory fragments.", color: "text-accent" },
              { icon: Gamepad2, title: "Rhythm Game", jp: "リズムゲーム", desc: "Interactive browser-based rhythm action. Feel the beat of Mirco's heart.", color: "text-primary" },
              { icon: Coins, title: "MIRCO Token", jp: "MIRCO トークン", desc: "A living economy granting access, voting rights, and community power.", color: "text-white" }
            ].map((pillar, i) => (
              <motion.div 
                key={i} 
                variants={fadeIn}
                className="group relative p-8 rounded-3xl bg-card/30 border border-white/5 hover:border-white/20 transition-all duration-500 overflow-hidden backdrop-blur-sm"
              >
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${pillar.color.split('-')[1]} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                <pillar.icon className={`w-12 h-12 mb-6 ${pillar.color} opacity-80 group-hover:scale-110 group-hover:opacity-100 transition-transform`} />
                <div className="font-jp text-sm text-muted-foreground mb-2">{pillar.jp}</div>
                <h3 className="text-2xl font-serif font-bold mb-4">{pillar.title}</h3>
                <p className="text-muted-foreground">{pillar.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Story & Music Section */}
      <section className="py-32 relative z-10 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img src="/bg-music.png" alt="Music Background" className="w-full h-full object-cover opacity-20 mix-blend-screen" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background" />
        </div>
        
        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <motion.div 
            className="flex flex-col lg:flex-row items-center gap-16"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div className="flex-1" variants={fadeIn}>
              <h2 className="text-4xl md:text-5xl font-serif mb-6 text-glow">
                <span className="block font-jp text-secondary/60 text-lg mb-2 tracking-widest">記憶の欠片</span>
                Memory Fragments
              </h2>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                As you play through the rhythm tracks, you collect Fragments. These elusive shards of the past unlock new story chapters, revealing the tragic and beautiful history of Mirco.
              </p>
              <div className="space-y-4">
                {['Chapter 01: Awakening', 'Chapter 02: Echoes in the Rain', 'Chapter 03: The Locked Heart'].map((chap, i) => (
                  <div key={i} className="flex items-center p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
                    <Disc className="w-6 h-6 mr-4 text-secondary/70" />
                    <span className="font-medium">{chap}</span>
                    {i > 0 && <span className="ml-auto text-xs text-primary bg-primary/10 px-3 py-1 rounded-full border border-primary/20">Locked</span>}
                  </div>
                ))}
              </div>
            </motion.div>
            
            <motion.div className="flex-1 w-full" variants={fadeIn}>
              <div className="font-jp text-secondary/60 text-sm tracking-widest mb-3">オリジナル楽曲</div>
              <h3 className="font-serif text-2xl font-bold mb-6 text-white/90">Original Tracks</h3>
              <MusicPlayer />
              <p className="text-xs text-white/30 mt-4 text-center">More tracks unlock as you collect Memory Fragments</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Rhythm Game — Playable */}
      <section id="play" className="py-32 px-6 relative z-10 bg-black/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeIn}
            >
              <span className="block font-jp text-primary/60 text-lg mb-2 tracking-widest">リズムゲーム</span>
              <h2 className="text-4xl md:text-5xl font-serif mb-4 text-glow">Play the Beat</h2>
              <p className="text-xl text-muted-foreground">D・F・J・K キーまたはタップでノーツを叩け。</p>
            </motion.div>
          </div>
          
          <motion.div 
            className="relative rounded-3xl overflow-hidden border border-white/20 shadow-[0_0_50px_rgba(0,0,0,0.8)] group cursor-pointer"
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            onClick={() => setGameOpen(true)}
          >
            <img src="/rhythm-game.png" alt="Rhythm Game" className="w-full aspect-video object-cover transition-transform duration-700 group-hover:scale-105 opacity-60 group-hover:opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  className="w-28 h-28 bg-primary/20 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/40 shadow-[0_0_40px_rgba(168,85,247,0.4)]"
                  whileHover={{ scale: 1.1 }}
                  animate={{ boxShadow: ['0 0 30px rgba(168,85,247,0.3)', '0 0 60px rgba(168,85,247,0.6)', '0 0 30px rgba(168,85,247,0.3)'] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Play className="w-12 h-12 ml-2 text-white fill-white" />
                </motion.div>
                <h3 className="text-4xl font-serif font-bold tracking-widest text-white" style={{ textShadow: '0 0 30px rgba(168,85,247,0.8)' }}>START GAME</h3>
                <p className="text-white/50 mt-3 text-sm tracking-widest font-jp">replay（仮） — Chapter 01</p>
                <div className="flex gap-3 justify-center mt-6">
                  {['D', 'F', 'J', 'K'].map((k) => (
                    <div key={k} className="w-10 h-10 rounded-lg border border-white/30 bg-white/10 backdrop-blur-sm flex items-center justify-center font-bold text-white/70 text-sm">
                      {k}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature highlights */}
          <div className="grid grid-cols-3 gap-4 mt-8">
            {[
              { label: '4レーン落下ノーツ', sub: '4-Lane Notes' },
              { label: 'コンボ＆スコア', sub: 'Combo & Score' },
              { label: 'ランキング登録', sub: 'Leaderboard' },
            ].map((f, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setGameOpen(true)}>
                <div className="font-jp text-white/70 text-sm mb-1">{f.label}</div>
                <div className="text-white/30 text-xs tracking-widest">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Token & Community */}
      <section id="token" className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <motion.div 
            className="bg-card/40 backdrop-blur-xl border border-primary/30 rounded-3xl p-8 md:p-16 text-center relative overflow-hidden"
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
            
            <Coins className="w-16 h-16 mx-auto mb-6 text-primary" />
            <h2 className="text-3xl md:text-4xl font-serif mb-4 text-glow">MIRCO Token</h2>
            <p className="text-muted-foreground mb-10 max-w-2xl mx-auto">
              More than a meme coin. MIRCO is the lifeblood of the project ecosystem. Holders gain access to exclusive story arcs, limited edition tracks, and voting rights for future developments.
            </p>

            <div className="bg-black/50 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-4 mb-10 group">
              <div className="flex-1 font-mono text-sm md:text-base text-primary/80 truncate w-full text-left">
                {CONTRACT_ADDRESS}
              </div>
              <Button onClick={copyToClipboard} variant="secondary" className="shrink-0 group-hover:bg-primary group-hover:text-white transition-colors">
                <Copy className="w-4 h-4 mr-2" /> Copy CA
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {[
                { title: "Exclusive Content", desc: "Unlock B-sides and secret lore." },
                { title: "Voting Rights", desc: "Shape Mirco's narrative future." },
                { title: "Community Hub", desc: "Join the inner circle of fans." }
              ].map((util, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-6 border border-white/5">
                  <h4 className="font-bold mb-2 text-white/90">{util.title}</h4>
                  <p className="text-sm text-muted-foreground">{util.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-black/60 relative z-10">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="font-serif font-bold text-2xl tracking-widest text-glow-pink">MIRCO</div>
          
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="https://twitter.com/aoiao901" target="_blank" rel="noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
              <SiX className="w-4 h-4" /> @aoiao901
            </a>
          </div>
          
          <div className="text-xs text-muted-foreground/50">
            © 2025 Mirco Rhythm Project. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
