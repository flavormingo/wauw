(function() {
    'use strict';

    class AudioEngine {
        constructor() {
            this.ctx = null;
            this.masterGain = null;
            this.isInitialized = false;
        }

        async init() {
            if (this.isInitialized) return;

            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.connect(this.ctx.destination);
            this.masterGain.gain.value = 0.7;

            if (this.ctx.state === 'suspended') {
                await this.ctx.resume();
            }

            this.isInitialized = true;
        }

        get currentTime() {
            return this.ctx ? this.ctx.currentTime : 0;
        }

        midiToFreq(note) {
            return 440 * Math.pow(2, (note - 69) / 12);
        }

        playNote(channel, note, time, duration) {
            if (!this.isInitialized) return;

            const freq = this.midiToFreq(note);
            const preset = channel.preset;
            const volume = channel.muted ? 0 : channel.volume;

            switch (preset.type) {
                case 'kick':
                    this.playKick(freq, time, duration, volume, preset);
                    break;
                case 'snare':
                    this.playSnare(freq, time, duration, volume, preset);
                    break;
                case 'hihat':
                    this.playHihat(freq, time, duration, volume, preset);
                    break;
                case 'bass':
                    this.playBass(freq, time, duration, volume, preset);
                    break;
                case 'lead':
                    this.playLead(freq, time, duration, volume, preset);
                    break;
                case 'pad':
                    this.playPad(freq, time, duration, volume, preset);
                    break;
                default:
                    this.playOsc(freq, time, duration, volume, preset);
            }
        }

        playKick(freq, time, duration, volume, preset) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * 4, time);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.08);

            gain.gain.setValueAtTime(volume * 1.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc.stop(time + 0.3);
        }

        playSnare(freq, time, duration, volume, preset) {
            const bufferSize = this.ctx.sampleRate * 0.2;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const noiseFilter = this.ctx.createBiquadFilter();
            noiseFilter.type = 'highpass';
            noiseFilter.frequency.value = 1000;

            const noiseGain = this.ctx.createGain();
            noiseGain.gain.setValueAtTime(volume * 0.5, time);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

            noise.connect(noiseFilter);
            noiseFilter.connect(noiseGain);
            noiseGain.connect(this.masterGain);

            const osc = this.ctx.createOscillator();
            const oscGain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, time);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.05);

            oscGain.gain.setValueAtTime(volume * 0.7, time);
            oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

            osc.connect(oscGain);
            oscGain.connect(this.masterGain);

            noise.start(time);
            noise.stop(time + 0.2);
            osc.start(time);
            osc.stop(time + 0.1);
        }

        playHihat(freq, time, duration, volume, preset) {
            const bufferSize = this.ctx.sampleRate * 0.1;
            const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = this.ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = freq * 20;

            const filter2 = this.ctx.createBiquadFilter();
            filter2.type = 'bandpass';
            filter2.frequency.value = freq * 40;
            filter2.Q.value = 1;

            const gain = this.ctx.createGain();
            const decayTime = preset.decay || 0.08;
            gain.gain.setValueAtTime(volume * 0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + decayTime);

            noise.connect(filter);
            filter.connect(filter2);
            filter2.connect(gain);
            gain.connect(this.masterGain);

            noise.start(time);
            noise.stop(time + decayTime + 0.01);
        }

        playBass(freq, time, duration, volume, preset) {
            const osc = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            osc2.type = 'square';
            osc2.frequency.value = freq;
            osc2.detune.value = -5;

            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(freq * 8, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 2, time + 0.1);
            filter.Q.value = 2;

            const actualDuration = Math.min(duration, 0.5);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.5, time + 0.01);
            gain.gain.setValueAtTime(volume * 0.5, time + actualDuration - 0.05);
            gain.gain.linearRampToValueAtTime(0, time + actualDuration);

            const mixer = this.ctx.createGain();
            mixer.gain.value = 0.5;

            osc.connect(mixer);
            osc2.connect(mixer);
            mixer.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc2.start(time);
            osc.stop(time + actualDuration + 0.01);
            osc2.stop(time + actualDuration + 0.01);
        }

        playLead(freq, time, duration, volume, preset) {
            const osc = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = 'sawtooth';
            osc.frequency.value = freq;

            osc2.type = 'sawtooth';
            osc2.frequency.value = freq;
            osc2.detune.value = 7;

            filter.type = 'lowpass';
            filter.frequency.value = freq * 4;
            filter.Q.value = 1;

            const attack = 0.02;
            const release = 0.1;
            const actualDuration = Math.max(duration, attack + release);

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.35, time + attack);
            gain.gain.setValueAtTime(volume * 0.35, time + actualDuration - release);
            gain.gain.linearRampToValueAtTime(0, time + actualDuration);

            const mixer = this.ctx.createGain();
            mixer.gain.value = 0.5;

            osc.connect(mixer);
            osc2.connect(mixer);
            mixer.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc2.start(time);
            osc.stop(time + actualDuration + 0.01);
            osc2.stop(time + actualDuration + 0.01);
        }

        playPad(freq, time, duration, volume, preset) {
            const oscs = [];
            const gains = [];
            const detuneAmounts = [-10, -5, 0, 5, 10];

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = freq * 3;
            filter.Q.value = 0.5;

            const masterPadGain = this.ctx.createGain();

            const attack = 0.15;
            const release = 0.3;
            const actualDuration = Math.max(duration, attack + release + 0.1);

            masterPadGain.gain.setValueAtTime(0, time);
            masterPadGain.gain.linearRampToValueAtTime(volume * 0.2, time + attack);
            masterPadGain.gain.setValueAtTime(volume * 0.2, time + actualDuration - release);
            masterPadGain.gain.linearRampToValueAtTime(0, time + actualDuration);

            detuneAmounts.forEach((detune, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();

                osc.type = i % 2 === 0 ? 'sawtooth' : 'triangle';
                osc.frequency.value = freq;
                osc.detune.value = detune;

                gain.gain.value = 0.2;

                osc.connect(gain);
                gain.connect(filter);

                oscs.push(osc);
                gains.push(gain);
            });

            filter.connect(masterPadGain);
            masterPadGain.connect(this.masterGain);

            oscs.forEach(osc => {
                osc.start(time);
                osc.stop(time + actualDuration + 0.01);
            });
        }

        playOsc(freq, time, duration, volume, preset) {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = preset.waveform || 'sine';
            osc.frequency.value = freq;

            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.3, time + 0.01);
            gain.gain.setValueAtTime(volume * 0.3, time + duration - 0.05);
            gain.gain.linearRampToValueAtTime(0, time + duration);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start(time);
            osc.stop(time + duration + 0.01);
        }

    }

    class Pattern {
        constructor(id, name) {
            this.id = id;
            this.name = name;
        }
    }

    class Channel {
        constructor(id, name, preset) {
            this.id = id;
            this.name = name;
            this.preset = preset;
            this.volume = 0.8;
            this.pan = 0;
            this.muted = false;
            this.notes = {};
        }

        getNotes(patternId) {
            if (!this.notes[patternId]) {
                this.notes[patternId] = [];
            }
            return this.notes[patternId];
        }
    }

    class Note {
        constructor(pitch, step, duration = 1) {
            this.pitch = pitch;
            this.step = step;
            this.duration = duration;
        }
    }

    class Clip {
        constructor(patternId, lane, startBar, length = 1) {
            this.patternId = patternId;
            this.lane = lane;
            this.startBar = startBar;
            this.length = length;
        }
    }

    class Sequencer {
        constructor(audioEngine, state) {
            this.audio = audioEngine;
            this.state = state;
            this.isPlaying = false;
            this.isPaused = false;
            this.currentStep = 0;
            this.currentBar = 0;
            this.tempo = 120;
            this.scheduleAheadTime = 0.1;
            this.lookAhead = 25;
            this.nextStepTime = 0;
            this.timerID = null;
        }

        get stepDuration() {
            return 60.0 / this.tempo / 4;
        }

        get barDuration() {
            return this.stepDuration * 16;
        }

        start(fromBeginning = false) {
            if (this.isPlaying) return;

            this.isPlaying = true;

            if (fromBeginning || !this.isPaused) {
                this.currentStep = 0;
                this.currentBar = 0;
            }

            this.isPaused = false;
            this.nextStepTime = this.audio.currentTime;
            this.scheduler();
        }

        pause() {
            this.isPlaying = false;
            this.isPaused = true;
            if (this.timerID) {
                clearTimeout(this.timerID);
                this.timerID = null;
            }
        }

        stop() {
            this.isPlaying = false;
            this.isPaused = false;
            if (this.timerID) {
                clearTimeout(this.timerID);
                this.timerID = null;
            }
            this.currentStep = 0;
            this.currentBar = 0;
        }

        scheduler() {
            while (this.nextStepTime < this.audio.currentTime + this.scheduleAheadTime) {
                this.scheduleStep(this.currentStep, this.nextStepTime);
                this.advanceStep();
            }

            if (this.isPlaying) {
                this.timerID = setTimeout(() => this.scheduler(), this.lookAhead);
            }
        }

        scheduleStep(step, time) {
            const mode = this.state.playbackMode;

            if (mode === 'pattern') {
                this.schedulePatternStep(step, time);
            } else {
                this.scheduleSongStep(step, time);
            }

            setTimeout(() => {
                this.state.onStepChange?.(step, this.currentBar);
            }, (time - this.audio.currentTime) * 1000);
        }

        schedulePatternStep(step, time) {
            const pattern = this.state.selectedPattern;
            if (!pattern) return;

            this.state.channels.forEach(channel => {
                const notes = channel.getNotes(pattern.id);
                const isDrum = DRUM_TYPES.includes(channel.preset.type);

                notes.forEach(n => {
                    if (isDrum) {
                        if (step >= n.step && step < n.step + n.duration) {
                            this.audio.playNote(channel, n.pitch, time, this.stepDuration);
                        }
                    } else {
                        if (n.step === step) {
                            const duration = n.duration * this.stepDuration;
                            this.audio.playNote(channel, n.pitch, time, duration);
                        }
                    }
                });
            });
        }

        scheduleSongStep(step, time) {
            const absoluteStep = this.currentBar * 16 + step;

            this.state.clips.forEach(clip => {
                const clipStartStep = clip.startBar * 16;
                const clipEndStep = clipStartStep + clip.length * 16;

                if (absoluteStep >= clipStartStep && absoluteStep < clipEndStep) {
                    const localStep = (absoluteStep - clipStartStep) % 16;

                    this.state.channels.forEach(channel => {
                        const notes = channel.getNotes(clip.patternId);
                        const isDrum = DRUM_TYPES.includes(channel.preset.type);

                        notes.forEach(n => {
                            if (isDrum) {
                                if (localStep >= n.step && localStep < n.step + n.duration) {
                                    this.audio.playNote(channel, n.pitch, time, this.stepDuration);
                                }
                            } else {
                                if (n.step === localStep) {
                                    const duration = n.duration * this.stepDuration;
                                    this.audio.playNote(channel, n.pitch, time, duration);
                                }
                            }
                        });
                    });
                }
            });
        }

        advanceStep() {
            this.nextStepTime += this.stepDuration;
            this.currentStep++;

            if (this.currentStep >= 16) {
                this.currentStep = 0;

                if (this.state.playbackMode === 'song') {
                    this.currentBar++;
                    if (this.currentBar >= this.state.playlistBars) {
                        this.currentBar = 0;
                    }
                }
            }
        }
    }

    const DRUM_TYPES = ['kick', 'snare', 'hihat'];

    const presets = {
        kick: { type: 'kick', defaultNote: 36, color: '#ef4444' },
        snare: { type: 'snare', defaultNote: 38, color: '#f97316' },
        hihat: { type: 'hihat', defaultNote: 42, decay: 0.08, color: '#eab308' },
        openhat: { type: 'hihat', defaultNote: 46, decay: 0.2, color: '#eab308' },
        bass: { type: 'bass', defaultNote: 36, color: '#22c55e' },
        lead: { type: 'lead', defaultNote: 48, color: '#06b6d4' },
        pad: { type: 'pad', defaultNote: 48, color: '#a855f7' }
    };

    const state = {
        patterns: [],
        channels: [],
        clips: [],
        selectedPatternId: null,
        selectedChannelId: null,
        playbackMode: 'pattern',
        playlistBars: 8,
        onStepChange: null,
        nextPatternId: 1,
        nextChannelId: 1,

        get selectedPattern() {
            return this.patterns.find(p => p.id === this.selectedPatternId);
        },

        get selectedChannel() {
            return this.channels.find(c => c.id === this.selectedChannelId);
        }
    };

    function initDefaultProject() {
        const pattern1 = new Pattern('p1', 'demo pattern');
        state.patterns.push(pattern1);
        state.selectedPatternId = 'p1';

        const kick = new Channel('c1', 'kick', presets.kick);
        const snare = new Channel('c2', 'snare', presets.snare);
        const hihat = new Channel('c3', 'hihat', presets.hihat);
        const openhat = new Channel('c4', 'openhat', presets.openhat);
        const bass = new Channel('c5', 'bass', presets.bass);
        const lead = new Channel('c6', 'lead', presets.lead);
        const pad = new Channel('c7', 'pad', presets.pad);

        state.channels.push(kick, snare, hihat, openhat, bass, lead, pad);
        state.selectedChannelId = 'c1';

        const kickNotes = kick.getNotes('p1');
        kickNotes.push(new Note(36, 0, 1));
        kickNotes.push(new Note(36, 3, 1));
        kickNotes.push(new Note(36, 6, 1));
        kickNotes.push(new Note(36, 10, 1));
        kickNotes.push(new Note(36, 14, 1));

        const snareNotes = snare.getNotes('p1');
        snareNotes.push(new Note(38, 4, 1));
        snareNotes.push(new Note(38, 12, 1));

        const hihatNotes = hihat.getNotes('p1');
        for (let i = 0; i < 16; i++) {
            hihatNotes.push(new Note(42, i, 1));
        }

        const openhatNotes = openhat.getNotes('p1');
        openhatNotes.push(new Note(46, 2, 1));
        openhatNotes.push(new Note(46, 8, 1));

        const bassNotes = bass.getNotes('p1');
        bassNotes.push(new Note(36, 0, 3));
        bassNotes.push(new Note(36, 3, 3));
        bassNotes.push(new Note(39, 6, 2));
        bassNotes.push(new Note(36, 10, 2));
        bassNotes.push(new Note(34, 14, 2));

        const leadNotes = lead.getNotes('p1');
        leadNotes.push(new Note(60, 0, 2));
        leadNotes.push(new Note(63, 2, 1));
        leadNotes.push(new Note(55, 4, 2));
        leadNotes.push(new Note(58, 8, 2));
        leadNotes.push(new Note(60, 10, 1));
        leadNotes.push(new Note(55, 12, 4));

        const padNotes = pad.getNotes('p1');
        padNotes.push(new Note(48, 0, 16));
        padNotes.push(new Note(51, 0, 16));
        padNotes.push(new Note(55, 0, 16));

        state.clips.push(new Clip('p1', 0, 0, 4));

        state.nextPatternId = 2;
        state.nextChannelId = 8;
    }

    const PIANO_OCTAVES = 2;
    const PIANO_START_NOTE = 36;
    const NOTE_NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
    const BLACK_KEYS = [1, 3, 6, 8, 10];

    function renderPatterns() {
        const container = document.querySelector('[data-patterns]');
        container.innerHTML = '';

        state.patterns.forEach(pattern => {
            const li = document.createElement('li');
            li.dataset.id = pattern.id;
            if (pattern.id === state.selectedPatternId) {
                li.dataset.selected = 'true';
            }

            const nameSpan = document.createElement('span');
            nameSpan.textContent = pattern.name;
            nameSpan.addEventListener('click', () => selectPattern(pattern.id));

            const editBtn = document.createElement('button');
            editBtn.title = 'rename pattern';
            editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M36.4 353.2c4.1-14.6 11.8-27.9 22.6-38.7l181.2-181.2 33.9-33.9c16.6 16.6 51.3 51.3 104 104l33.9 33.9-33.9 33.9-181.2 181.2c-10.7 10.7-24.1 18.5-38.7 22.6L30.4 510.6c-8.3 2.3-17.3 0-23.4-6.2S-1.4 489.3 .9 481L36.4 353.2zm55.6-3.7c-4.4 4.7-7.6 10.4-9.3 16.6l-24.1 86.9 86.9-24.1c6.4-1.8 12.2-5.1 17-9.7L91.9 349.5zm354-146.1c-16.6-16.6-51.3-51.3-104-104L308 65.5C334.5 39 349.4 24.1 352.9 20.6 366.4 7 384.8-.6 404-.6S441.6 7 455.1 20.6l35.7 35.7C504.4 69.9 512 88.3 512 107.4s-7.6 37.6-21.2 51.1c-3.5 3.5-18.4 18.4-44.9 44.9z"/></svg>';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                const input = document.createElement('input');
                input.type = 'text';
                input.value = pattern.name;
                input.style.cssText = 'flex:1;background:var(--bg-dark);border:1px solid var(--accent);border-radius:2px;padding:2px 4px;color:inherit;font:inherit;outline:none;';

                const finishEdit = () => {
                    const newName = input.value.trim();
                    if (newName) {
                        pattern.name = newName;
                    }
                    renderPatterns();
                    renderPlaylist();
                };

                input.addEventListener('blur', finishEdit);
                input.addEventListener('keydown', (ke) => {
                    if (ke.key === 'Enter') {
                        input.blur();
                    } else if (ke.key === 'Escape') {
                        input.value = pattern.name;
                        input.blur();
                    }
                });

                nameSpan.replaceWith(input);
                input.focus();
                input.select();
            });

            li.appendChild(nameSpan);
            li.appendChild(editBtn);
            container.appendChild(li);
        });
    }

    function renderChannels() {
        const container = document.querySelector('[data-channels]');
        container.innerHTML = '';

        state.channels.forEach(channel => {
            const li = document.createElement('li');
            if (channel.id === state.selectedChannelId) {
                li.dataset.selected = 'true';
            }

            const header = document.createElement('header');

            const muteBtn = document.createElement('button');
            muteBtn.style.background = channel.preset.color;
            muteBtn.style.color = 'white';
            muteBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path fill="currentColor" d="M533.6 32.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C557.5 113.8 592 180.8 592 256s-34.5 142.2-88.7 186.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C598.5 426.7 640 346.2 640 256S598.5 85.2 533.6 32.5zM473.1 107c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C475.3 170.7 496 210.9 496 256s-20.7 85.3-53.2 111.8c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5c43.2-35.2 70.9-88.9 70.9-149s-27.7-113.8-70.9-149zm-60.5 74.5c-10.3-8.4-25.4-6.8-33.8 3.5s-6.8 25.4 3.5 33.8C393.1 227.6 400 241 400 256s-6.9 28.4-17.7 37.3c-10.3 8.4-11.8 23.5-3.5 33.8s23.5 11.8 33.8 3.5C434.1 312.9 448 286.1 448 256s-13.9-56.9-35.4-74.5zM80 352l48 0 134.1 119.2c6.4 5.7 14.6 8.8 23.1 8.8 19.2 0 34.8-15.6 34.8-34.8l0-378.4c0-19.2-15.6-34.8-34.8-34.8-8.5 0-16.7 3.1-23.1 8.8L128 160 80 160c-26.5 0-48 21.5-48 48l0 96c0 26.5 21.5 48 48 48z"/></svg>';
            muteBtn.dataset.muted = channel.muted;
            muteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                channel.muted = !channel.muted;
                muteBtn.dataset.muted = channel.muted;
                renderMixer();
            });

            const nameSpan = document.createElement('span');
            nameSpan.textContent = channel.name;
            nameSpan.addEventListener('click', () => selectChannel(channel.id));

            const editBtn = document.createElement('button');
            editBtn.dataset.edit = 'true';
            editBtn.title = 'rename channel';
            editBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="currentColor" d="M36.4 353.2c4.1-14.6 11.8-27.9 22.6-38.7l181.2-181.2 33.9-33.9c16.6 16.6 51.3 51.3 104 104l33.9 33.9-33.9 33.9-181.2 181.2c-10.7 10.7-24.1 18.5-38.7 22.6L30.4 510.6c-8.3 2.3-17.3 0-23.4-6.2S-1.4 489.3 .9 481L36.4 353.2zm55.6-3.7c-4.4 4.7-7.6 10.4-9.3 16.6l-24.1 86.9 86.9-24.1c6.4-1.8 12.2-5.1 17-9.7L91.9 349.5zm354-146.1c-16.6-16.6-51.3-51.3-104-104L308 65.5C334.5 39 349.4 24.1 352.9 20.6 366.4 7 384.8-.6 404-.6S441.6 7 455.1 20.6l35.7 35.7C504.4 69.9 512 88.3 512 107.4s-7.6 37.6-21.2 51.1c-3.5 3.5-18.4 18.4-44.9 44.9z"/></svg>';
            editBtn.addEventListener('click', (e) => {
                e.stopPropagation();

                const input = document.createElement('input');
                input.type = 'text';
                input.value = channel.name;
                input.style.cssText = 'flex:1;background:var(--bg-dark);border:1px solid var(--accent);border-radius:2px;padding:2px 4px;color:inherit;font:inherit;font-size:11px;outline:none;';

                const finishEdit = () => {
                    const newName = input.value.trim();
                    if (newName) {
                        channel.name = newName;
                    }
                    renderChannels();
                    renderMixer();
                };

                input.addEventListener('blur', finishEdit);
                input.addEventListener('keydown', (ke) => {
                    if (ke.key === 'Enter') {
                        input.blur();
                    } else if (ke.key === 'Escape') {
                        input.value = channel.name;
                        input.blur();
                    }
                });

                nameSpan.replaceWith(input);
                input.focus();
                input.select();
            });

            header.appendChild(muteBtn);
            header.appendChild(nameSpan);
            header.appendChild(editBtn);
            li.appendChild(header);

            const stepsEl = document.createElement('ol');
            const channelNotes = channel.getNotes(state.selectedPatternId);
            const defaultPitch = channel.preset.defaultNote || 48;

            for (let i = 0; i < 16; i++) {
                const step = document.createElement('li');
                const hasNoteAtStep = channelNotes.some(n => n.step <= i && i < n.step + n.duration);
                step.dataset.active = hasNoteAtStep;
                if (i % 4 === 0 && i > 0) {
                    step.dataset.beat = 'true';
                }
                step.addEventListener('click', () => {
                    if (!state.selectedPatternId) return;
                    const notesAtStep = channelNotes.filter(n => n.step <= i && i < n.step + n.duration);
                    if (notesAtStep.length > 0) {
                        notesAtStep.forEach(n => {
                            const idx = channelNotes.indexOf(n);
                            if (idx !== -1) channelNotes.splice(idx, 1);
                        });
                    } else {
                        channelNotes.push(new Note(defaultPitch, i, 1));
                    }
                    renderChannels();
                    renderPianoRoll();
                });
                stepsEl.appendChild(step);
            }

            li.appendChild(stepsEl);
            container.appendChild(li);
        });
    }

    function renderPianoRoll() {
        const keysContainer = document.querySelector('[data-piano-keys]');
        const gridContainer = document.querySelector('[data-piano-grid]');
        const channelNameDisplay = document.querySelector('[data-channel-name]');

        keysContainer.innerHTML = '';
        gridContainer.innerHTML = '';

        const channel = state.selectedChannel;
        channelNameDisplay.textContent = channel ? channel.name : '-';

        const totalNotes = PIANO_OCTAVES * 12;

        for (let i = totalNotes - 1; i >= 0; i--) {
            const noteInOctave = i % 12;
            const midiNote = PIANO_START_NOTE + i;
            const octave = Math.floor(midiNote / 12) - 1;
            const isBlack = BLACK_KEYS.includes(noteInOctave);

            const key = document.createElement('span');
            key.textContent = NOTE_NAMES[noteInOctave] + octave;
            key.dataset.black = isBlack;
            keysContainer.appendChild(key);
        }

        const notes = channel ? channel.getNotes(state.selectedPatternId) : [];

        for (let row = totalNotes - 1; row >= 0; row--) {
            const pitch = PIANO_START_NOTE + row;
            const noteInOctave = row % 12;
            const isBlack = BLACK_KEYS.includes(noteInOctave);

            for (let col = 0; col < 16; col++) {
                const cell = document.createElement('span');
                cell.dataset.black = isBlack;
                cell.dataset.row = totalNotes - 1 - row;
                cell.dataset.col = col;
                cell.dataset.pitch = pitch;

                cell.addEventListener('click', (e) => {
                    if (!channel) return;
                    if (e.target !== cell) return;

                    notes.push(new Note(pitch, col, 1));
                    renderChannels();
                    renderPianoRoll();
                });

                gridContainer.appendChild(cell);
            }
        }

        const playhead = document.createElement('mark');
        gridContainer.appendChild(playhead);

        const cellWidth = 100 / 16;
        const cellHeight = 100 / totalNotes;

        notes.forEach((note) => {
            const row = totalNotes - 1 - (note.pitch - PIANO_START_NOTE);
            if (row >= 0 && row < totalNotes) {
                createNoteBlock(gridContainer, note.step, row, note.duration, note.pitch, cellWidth, cellHeight, channel, note);
            }
        });
    }

    function createNoteBlock(container, col, row, duration, pitch, cellWidth, cellHeight, channel, noteObj) {
        const block = document.createElement('article');
        block._note = noteObj;
        block.style.left = (col * cellWidth) + '%';
        block.style.top = (row * cellHeight) + '%';
        block.style.width = (duration * cellWidth) + '%';
        block.style.height = cellHeight + '%';
        block.style.cursor = 'grab';

        let wasResizing = false;
        let wasDragging = false;

        block.addEventListener('click', (e) => {
            if (wasResizing || wasDragging) {
                wasResizing = false;
                wasDragging = false;
                return;
            }
            e.stopPropagation();

            if (block._note) {
                const channelNotes = channel.getNotes(state.selectedPatternId);
                const idx = channelNotes.indexOf(block._note);
                if (idx !== -1) {
                    channelNotes.splice(idx, 1);
                }
            }
            renderChannels();
            renderPianoRoll();
        });

        block.addEventListener('mousedown', (e) => {
            const rect = block.getBoundingClientRect();
            const rightEdge = rect.right - 8;
            const containerRect = container.getBoundingClientRect();

            if (e.clientX >= rightEdge) {
                wasResizing = true;
                const startX = e.clientX;
                const startWidth = rect.width;
                e.preventDefault();
                e.stopPropagation();

                const stepWidth = containerRect.width / 16;

                const onMouseMove = (moveE) => {
                    const delta = moveE.clientX - startX;
                    const newWidthPx = Math.max(stepWidth * 0.5, startWidth + delta);
                    const newDuration = Math.max(1, Math.round(newWidthPx / stepWidth));
                    const maxDuration = 16 - col;
                    const clampedDuration = Math.min(newDuration, maxDuration);

                    block.style.width = (clampedDuration * cellWidth) + '%';
                    if (block._note) {
                        block._note.duration = clampedDuration;
                    }
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    renderChannels();
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            } else {
                e.preventDefault();
                e.stopPropagation();

                const startX = e.clientX;
                const startY = e.clientY;
                const startCol = col;
                const startRow = row;

                block.dataset.dragCol = col;
                block.dataset.dragRow = row;
                block.dataset.hasMoved = 'false';

                block.style.cursor = 'grabbing';
                block.style.zIndex = '10';
                block.style.opacity = '0.8';

                const onMouseMove = (moveE) => {
                    const freshContainerRect = container.getBoundingClientRect();
                    const stepWidth = freshContainerRect.width / 16;
                    const rowHeight = freshContainerRect.height / 24;

                    const deltaX = moveE.clientX - startX;
                    const deltaY = moveE.clientY - startY;

                    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                        block.dataset.hasMoved = 'true';
                        wasDragging = true;
                    }

                    const deltaSteps = Math.round(deltaX / stepWidth);
                    const deltaRows = Math.round(deltaY / rowHeight);

                    const newCol = Math.max(0, Math.min(startCol + deltaSteps, 16 - duration));
                    const newRow = Math.max(0, Math.min(startRow + deltaRows, 23));

                    block.dataset.dragCol = newCol;
                    block.dataset.dragRow = newRow;

                    block.style.left = (newCol * cellWidth) + '%';
                    block.style.top = (newRow * cellHeight) + '%';
                };

                const onMouseUp = (upE) => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    block.style.cursor = 'grab';
                    block.style.zIndex = '';
                    block.style.opacity = '';

                    const hasMoved = block.dataset.hasMoved === 'true';
                    const finalCol = parseInt(block.dataset.dragCol, 10);
                    const finalRow = parseInt(block.dataset.dragRow, 10);

                    if (hasMoved) {
                        const newPitch = PIANO_START_NOTE + ((PIANO_OCTAVES * 12 - 1) - finalRow);

                        if (block._note) {
                            block._note.step = finalCol;
                            block._note.pitch = newPitch;
                        }
                        renderChannels();
                        renderPianoRoll();
                    }
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        });

        container.appendChild(block);
    }

    function renderPlaylist() {
        const timelineContainer = document.querySelector('[data-timeline]');
        const playlistContainer = document.querySelector('[data-playlist]');
        const NUM_LANES = 4;
        const barWidth = 100 / state.playlistBars;

        const playhead = playlistContainer.querySelector('mark');
        timelineContainer.innerHTML = '';
        playlistContainer.innerHTML = '';
        playlistContainer.appendChild(playhead);

        for (let i = 0; i < state.playlistBars; i++) {
            const span = document.createElement('span');
            span.textContent = (i + 1).toString();
            timelineContainer.appendChild(span);
        }

        for (let lane = 0; lane < NUM_LANES; lane++) {
            const laneDiv = document.createElement('div');
            laneDiv.dataset.lane = lane;

            for (let bar = 0; bar < state.playlistBars; bar++) {
                const slot = document.createElement('span');
                slot.dataset.bar = bar;
                slot.addEventListener('click', (e) => {
                    if (e.target !== slot) return;
                    if (state.selectedPatternId) {
                        const existingIndex = state.clips.findIndex(
                            c => c.lane === lane && c.startBar <= bar && bar < c.startBar + c.length
                        );

                        if (existingIndex < 0) {
                            state.clips.push(new Clip(state.selectedPatternId, lane, bar, 1));
                            renderPlaylist();
                        }
                    }
                });
                laneDiv.appendChild(slot);
            }

            state.clips.filter(c => c.lane === lane).forEach(clip => {
                const clipEl = document.createElement('article');
                const pattern = state.patterns.find(p => p.id === clip.patternId);
                clipEl.textContent = pattern ? pattern.name : '?';
                clipEl.style.left = (clip.startBar * barWidth) + '%';
                clipEl.style.width = 'calc(' + (clip.length * barWidth) + '% - 4px)';
                clipEl._clip = clip;

                let wasResizing = false;
                let wasDragging = false;

                clipEl.addEventListener('click', (e) => {
                    if (wasResizing || wasDragging) {
                        wasResizing = false;
                        wasDragging = false;
                        return;
                    }
                    e.stopPropagation();

                    const idx = state.clips.indexOf(clip);
                    if (idx !== -1) {
                        state.clips.splice(idx, 1);
                    }
                    renderPlaylist();
                });

                clipEl.addEventListener('mousedown', (e) => {
                    const rect = clipEl.getBoundingClientRect();
                    const rightEdge = rect.right - 8;
                    const laneRect = laneDiv.getBoundingClientRect();
                    const barWidthPx = laneRect.width / state.playlistBars;

                    if (e.clientX >= rightEdge) {
                        wasResizing = true;
                        const startX = e.clientX;
                        const startLength = clip.length;
                        e.preventDefault();
                        e.stopPropagation();

                        const onMouseMove = (moveE) => {
                            const delta = moveE.clientX - startX;
                            const deltaLengthBars = Math.round(delta / barWidthPx);
                            const newLength = Math.max(1, startLength + deltaLengthBars);
                            const maxLength = state.playlistBars - clip.startBar;
                            const clampedLength = Math.min(newLength, maxLength);

                            clipEl.style.width = 'calc(' + (clampedLength * barWidth) + '% - 4px)';
                            clip.length = clampedLength;
                        };

                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);
                            renderPlaylist();
                        };

                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    } else {
                        e.preventDefault();
                        e.stopPropagation();

                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startBar = clip.startBar;
                        const startLane = clip.lane;
                        let hasMoved = false;

                        clipEl.style.cursor = 'grabbing';
                        clipEl.style.zIndex = '10';
                        clipEl.style.opacity = '0.8';

                        const onMouseMove = (moveE) => {
                            const currentLaneRect = laneDiv.getBoundingClientRect();
                            const currentBarWidthPx = currentLaneRect.width / state.playlistBars;
                            const laneHeight = currentLaneRect.height;

                            const deltaX = moveE.clientX - startX;
                            const deltaY = moveE.clientY - startY;

                            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                                hasMoved = true;
                                wasDragging = true;
                            }

                            const deltaLanes = Math.round(deltaY / laneHeight);
                            const deltaBars = Math.round(deltaX / currentBarWidthPx);

                            const newBar = Math.max(0, Math.min(startBar + deltaBars, state.playlistBars - clip.length));
                            const newLane = Math.max(0, Math.min(startLane + deltaLanes, NUM_LANES - 1));

                            clipEl.style.left = (newBar * barWidth) + '%';
                            clipEl.style.top = ((newLane - startLane) * laneHeight + 2) + 'px';

                            clipEl.dataset.dragBar = newBar;
                            clipEl.dataset.dragLane = newLane;
                        };

                        const onMouseUp = () => {
                            document.removeEventListener('mousemove', onMouseMove);
                            document.removeEventListener('mouseup', onMouseUp);

                            clipEl.style.cursor = 'grab';
                            clipEl.style.zIndex = '';
                            clipEl.style.opacity = '';

                            if (hasMoved) {
                                const finalBar = parseInt(clipEl.dataset.dragBar, 10);
                                const finalLane = parseInt(clipEl.dataset.dragLane, 10);

                                clip.startBar = finalBar;
                                clip.lane = finalLane;
                                renderPlaylist();
                            }
                        };

                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('mouseup', onMouseUp);
                    }
                });

                laneDiv.appendChild(clipEl);
            });

            playlistContainer.appendChild(laneDiv);
        }
    }

    function renderMixer() {
        const container = document.querySelector('[data-mixer]');
        container.innerHTML = '';

        state.channels.forEach(channel => {
            const strip = document.createElement('article');

            const name = document.createElement('span');
            name.textContent = channel.name;

            const slidersDiv = document.createElement('div');

            const volLabel = document.createElement('label');
            const volLabelText = document.createElement('span');
            volLabelText.textContent = 'vol';
            const volumeSlider = document.createElement('input');
            volumeSlider.type = 'range';
            volumeSlider.min = 0;
            volumeSlider.max = 100;
            volumeSlider.value = channel.volume * 100;
            volumeSlider.addEventListener('input', (e) => {
                channel.volume = e.target.value / 100;
            });

            volLabel.appendChild(volLabelText);
            volLabel.appendChild(volumeSlider);

            const panLabel = document.createElement('label');
            const panLabelText = document.createElement('span');
            panLabelText.textContent = 'pan';
            const panSlider = document.createElement('input');
            panSlider.type = 'range';
            panSlider.min = -100;
            panSlider.max = 100;
            panSlider.value = channel.pan * 100;
            panSlider.addEventListener('input', (e) => {
                channel.pan = e.target.value / 100;
            });

            panLabel.appendChild(panLabelText);
            panLabel.appendChild(panSlider);

            slidersDiv.appendChild(volLabel);
            slidersDiv.appendChild(panLabel);

            strip.appendChild(name);
            strip.appendChild(slidersDiv);

            container.appendChild(strip);
        });
    }

    function selectPattern(id) {
        state.selectedPatternId = id;
        renderPatterns();
        renderChannels();
        renderPianoRoll();
    }

    function selectChannel(id) {
        state.selectedChannelId = id;
        renderChannels();
        renderPianoRoll();
    }

    function updatePlayhead(step, bar) {
        const pianoGrid = document.querySelector('[data-piano-grid]');
        const pianoPlayhead = pianoGrid?.querySelector('mark');
        if (pianoPlayhead) {
            if (step >= 0) {
                pianoGrid.dataset.playing = 'true';
                pianoPlayhead.style.left = ((step / 16) * 100) + '%';
            } else {
                pianoGrid.dataset.playing = 'false';
            }
        }

        if (state.playbackMode === 'song') {
            const playhead = document.querySelector('[data-playlist] > mark');
            const barWidth = 100 / state.playlistBars;
            const position = bar * barWidth + (step / 16) * barWidth;
            playhead.style.left = position + '%';
        }
    }

    const audioEngine = new AudioEngine();
    let sequencer = null;

    async function init() {
        initDefaultProject();

        renderPatterns();
        renderChannels();
        renderPianoRoll();
        renderPlaylist();
        renderMixer();

        setupEventListeners();
    }

    function setupEventListeners() {
        const playBtn = document.querySelector('[data-action="play"]');
        const playIcon = playBtn.querySelector('[data-icon="play"]');
        const pauseIcon = playBtn.querySelector('[data-icon="pause"]');

        function updatePlayButton(isPlaying) {
            playBtn.dataset.active = isPlaying;
            playBtn.title = isPlaying ? 'pause' : 'play';
            playIcon.style.display = isPlaying ? 'none' : 'block';
            pauseIcon.style.display = isPlaying ? 'block' : 'none';
            document.querySelector('[data-playlist]').dataset.playing = isPlaying;
        }

        playBtn.addEventListener('click', async () => {
            await audioEngine.init();

            if (!sequencer) {
                sequencer = new Sequencer(audioEngine, state);
                state.onStepChange = updatePlayhead;
            }

            sequencer.tempo = parseInt(document.querySelector('[data-tempo]').value) || 120;

            if (sequencer.isPlaying) {
                sequencer.pause();
                updatePlayButton(false);
            } else {
                sequencer.start();
                updatePlayButton(true);
            }
        });

        document.querySelector('[data-action="stop"]').addEventListener('click', () => {
            if (sequencer) {
                sequencer.stop();
                updatePlayButton(false);
                updatePlayhead(-1, 0);
            }
        });

        document.querySelectorAll('input[name="mode"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                state.playbackMode = e.target.value;
            });
        });

        document.querySelector('[data-tempo]').addEventListener('change', (e) => {
            if (sequencer) {
                sequencer.tempo = parseInt(e.target.value) || 120;
            }
        });

        document.querySelector('[data-action="add-pattern"]').addEventListener('click', () => {
            const id = 'p' + state.nextPatternId++;
            const pattern = new Pattern(id, 'pattern ' + (state.patterns.length + 1));
            state.patterns.push(pattern);
            selectPattern(id);
        });

        document.querySelector('[data-action="duplicate-pattern"]').addEventListener('click', () => {
            const current = state.selectedPattern;
            if (!current) return;

            const id = 'p' + state.nextPatternId++;
            const pattern = new Pattern(id, current.name + ' copy');
            state.patterns.push(pattern);

            state.channels.forEach(channel => {
                const srcNotes = channel.getNotes(current.id);
                const destNotes = channel.getNotes(id);
                srcNotes.forEach(n => destNotes.push(new Note(n.pitch, n.step, n.duration)));
            });

            selectPattern(id);
        });

        document.querySelector('[data-action="delete-pattern"]').addEventListener('click', () => {
            const current = state.selectedPattern;
            if (!current) return;

            state.clips = state.clips.filter(c => c.patternId !== current.id);

            const idx = state.patterns.indexOf(current);
            state.patterns.splice(idx, 1);

            if (state.patterns.length > 0) {
                selectPattern(state.patterns[Math.max(0, idx - 1)].id);
            } else {
                state.selectedPatternId = null;
                renderPatterns();
                renderChannels();
                renderPianoRoll();
            }
            renderPlaylist();
        });

        const instrumentDialog = document.querySelector('[data-instrument-dialog]');

        document.querySelector('[data-action="add-channel"]').addEventListener('click', () => {
            instrumentDialog.showModal();
        });

        document.querySelector('[data-action="close-dialog"]').addEventListener('click', () => {
            instrumentDialog.close();
        });

        instrumentDialog.addEventListener('click', (e) => {
            if (e.target === instrumentDialog) {
                instrumentDialog.close();
            }
        });

        instrumentDialog.querySelectorAll('li[data-preset]').forEach(li => {
            li.addEventListener('click', () => {
                const presetName = li.dataset.preset;
                const id = 'c' + state.nextChannelId++;
                const channel = new Channel(id, presetName, presets[presetName]);
                state.channels.push(channel);
                selectChannel(id);
                renderMixer();
                instrumentDialog.close();
            });
        });

        document.querySelector('[data-action="duplicate-channel"]').addEventListener('click', () => {
            const current = state.selectedChannel;
            if (!current) return;

            const id = 'c' + state.nextChannelId++;
            const channel = new Channel(id, current.name + ' copy', current.preset);
            channel.volume = current.volume;
            channel.pan = current.pan;
            state.channels.push(channel);

            state.patterns.forEach(pattern => {
                const srcNotes = current.getNotes(pattern.id);
                const destNotes = channel.getNotes(pattern.id);
                srcNotes.forEach(n => destNotes.push(new Note(n.pitch, n.step, n.duration)));
            });

            selectChannel(id);
            renderMixer();
        });

        document.querySelector('[data-action="delete-channel"]').addEventListener('click', () => {
            const current = state.selectedChannel;
            if (!current) return;

            const idx = state.channels.indexOf(current);
            state.channels.splice(idx, 1);

            if (state.channels.length > 0) {
                selectChannel(state.channels[Math.max(0, idx - 1)].id);
            } else {
                state.selectedChannelId = null;
                renderChannels();
                renderPianoRoll();
            }
            renderMixer();
        });

        document.querySelector('[data-playlist-bars]').addEventListener('change', (e) => {
            const newBars = parseInt(e.target.value, 10);
            state.playlistBars = newBars;
            state.clips = state.clips.filter(c => c.startBar < newBars);
            state.clips.forEach(c => {
                if (c.startBar + c.length > newBars) {
                    c.length = newBars - c.startBar;
                }
            });
            renderPlaylist();
        });

        document.querySelector('[data-action="export"]').addEventListener('click', async () => {
            await audioEngine.init();

            const tempo = parseInt(document.querySelector('[data-tempo]').value) || 120;
            const stepDuration = 60.0 / tempo / 4;
            const totalSteps = state.playlistBars * 16;
            const duration = totalSteps * stepDuration + 1;

            const offlineCtx = new OfflineAudioContext(2,
                audioEngine.ctx.sampleRate * duration,
                audioEngine.ctx.sampleRate);

            const masterGain = offlineCtx.createGain();
            masterGain.gain.value = 0.7;
            masterGain.connect(offlineCtx.destination);

            for (let bar = 0; bar < state.playlistBars; bar++) {
                for (let step = 0; step < 16; step++) {
                    const absoluteStep = bar * 16 + step;
                    const time = absoluteStep * stepDuration;

                    state.clips.forEach(clip => {
                        const clipStartStep = clip.startBar * 16;
                        const clipEndStep = clipStartStep + clip.length * 16;

                        if (absoluteStep >= clipStartStep && absoluteStep < clipEndStep) {
                            const localStep = (absoluteStep - clipStartStep) % 16;

                            state.channels.forEach(channel => {
                                if (channel.muted) return;

                                const notes = channel.getNotes(clip.patternId);
                                const isDrum = DRUM_TYPES.includes(channel.preset.type);

                                notes.forEach(n => {
                                    if (isDrum) {
                                        if (localStep >= n.step && localStep < n.step + n.duration) {
                                            scheduleOfflineNote(offlineCtx, masterGain, channel,
                                                n.pitch, time, stepDuration);
                                        }
                                    } else {
                                        if (n.step === localStep) {
                                            scheduleOfflineNote(offlineCtx, masterGain, channel,
                                                n.pitch, time, n.duration * stepDuration);
                                        }
                                    }
                                });
                            });
                        }
                    });
                }
            }

            const buffer = await offlineCtx.startRendering();
            downloadBuffer(buffer, 'wauw-export.wav');
        });
    }

    function scheduleOfflineNote(ctx, masterGain, channel, note, time, duration) {
        const freq = audioEngine.midiToFreq(note);
        const volume = channel.volume;
        const preset = channel.preset;

        if (preset.type === 'kick') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq * 4, time);
            osc.frequency.exponentialRampToValueAtTime(freq * 0.5, time + 0.08);
            gain.gain.setValueAtTime(volume * 1.2, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + 0.3);
        } else if (preset.type === 'snare') {
            const bufferSize = ctx.sampleRate * 0.2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 1000;
            const gain = ctx.createGain();
            gain.gain.setValueAtTime(volume * 0.5, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            noise.start(time);
            noise.stop(time + 0.2);
        } else if (preset.type === 'hihat') {
            const bufferSize = ctx.sampleRate * 0.1;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = freq * 20;
            const gain = ctx.createGain();
            const decay = preset.decay || 0.08;
            gain.gain.setValueAtTime(volume * 0.4, time);
            gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            noise.start(time);
            noise.stop(time + decay + 0.01);
        } else if (preset.type === 'bass') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(freq * 8, time);
            filter.frequency.exponentialRampToValueAtTime(freq * 2, time + 0.1);
            const d = Math.min(duration, 0.5);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.5, time + 0.01);
            gain.gain.setValueAtTime(volume * 0.5, time + d - 0.05);
            gain.gain.linearRampToValueAtTime(0, time + d);
            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + d + 0.01);
        } else if (preset.type === 'lead') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const d = Math.max(duration, 0.12);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.35, time + 0.02);
            gain.gain.setValueAtTime(volume * 0.35, time + d - 0.1);
            gain.gain.linearRampToValueAtTime(0, time + d);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + d + 0.01);
        } else if (preset.type === 'pad') {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.value = freq;
            const d = Math.max(duration, 0.45);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(volume * 0.2, time + 0.15);
            gain.gain.setValueAtTime(volume * 0.2, time + d - 0.3);
            gain.gain.linearRampToValueAtTime(0, time + d);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(time);
            osc.stop(time + d + 0.01);
        }
    }

    function downloadBuffer(buffer, filename) {
        const numChannels = buffer.numberOfChannels;
        const length = buffer.length;
        const sampleRate = buffer.sampleRate;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = length * blockAlign;
        const bufferSize = 44 + dataSize;

        const arrayBuffer = new ArrayBuffer(bufferSize);
        const view = new DataView(arrayBuffer);

        const writeString = (offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(0, 'RIFF');
        view.setUint32(4, bufferSize - 8, true);
        writeString(8, 'WAVE');
        writeString(12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        writeString(36, 'data');
        view.setUint32(40, dataSize, true);

        const channels = [];
        for (let i = 0; i < numChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        let offset = 44;
        for (let i = 0; i < length; i++) {
            for (let ch = 0; ch < numChannels; ch++) {
                let sample = channels[ch][i];
                sample = Math.max(-1, Math.min(1, sample));
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(offset, sample, true);
                offset += 2;
            }
        }

        const blob = new Blob([arrayBuffer], { type: 'audio/wav' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function initTheme() {
        const saved = localStorage.getItem('wauw-theme');
        if (saved) {
            document.documentElement.dataset.theme = saved;
            updateThemeIcon(saved);
        } else {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const theme = prefersDark ? 'dark' : 'light';
            document.documentElement.dataset.theme = theme;
            updateThemeIcon(theme);
        }

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('wauw-theme')) {
                const theme = e.matches ? 'dark' : 'light';
                document.documentElement.dataset.theme = theme;
                updateThemeIcon(theme);
            }
        });
    }

    function updateThemeIcon(theme) {
        const btn = document.querySelector('[data-action="toggle-theme"]');
        const sunIcon = btn.querySelector('[data-icon="sun"]');
        const moonIcon = btn.querySelector('[data-icon="moon"]');
        if (theme === 'dark') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    document.querySelector('[data-action="toggle-theme"]').addEventListener('click', () => {
        const current = document.documentElement.dataset.theme || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('wauw-theme', next);
        updateThemeIcon(next);
    });

    const infoDialog = document.querySelector('[data-info-dialog]');

    document.querySelector('[data-action="show-info"]').addEventListener('click', () => {
        infoDialog.showModal();
    });

    document.querySelector('[data-action="close-info"]').addEventListener('click', () => {
        infoDialog.close();
    });

    infoDialog.addEventListener('click', (e) => {
        if (e.target === infoDialog) {
            infoDialog.close();
        }
    });

    initTheme();

    init();
})();
