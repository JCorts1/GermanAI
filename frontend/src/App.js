import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Play, Trash2, Volume2, Brain, Sparkles } from 'lucide-react';
import './App.css'

const App = () => {
  const [recordings, setRecordings] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [playingId, setPlayingId] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'de-DE'; // German language

      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        setTranscription(prev => prev + finalTranscript);
        if (interimTranscript) {
          setIsTranscribing(true);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsTranscribing(false);
      };
    }
  }, []);

  useEffect(() => {
    fetchRecordings();
  }, []);

  const fetchRecordings = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/recordings');
      const data = await response.json();
      setRecordings(data);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await uploadRecording(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscription('');

      // Start speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Please allow microphone access to record audio.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // Stop speech recognition
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsTranscribing(false);
    }
  };

  const uploadRecording = async (audioBlob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'recording.webm');

    try {
      const response = await fetch('http://localhost:8000/api/recordings', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      // Update transcription if we have one
      if (transcription.trim()) {
        await updateTranscription(data.id, transcription);
      }

      fetchRecordings();
    } catch (error) {
      console.error('Error uploading recording:', error);
    }
  };

  const updateTranscription = async (recordingId, text) => {
    try {
      await fetch(`http://localhost:8000/api/recordings/${recordingId}/transcription`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ transcription: text }),
      });
      fetchRecordings();
    } catch (error) {
      console.error('Error updating transcription:', error);
    }
  };

  const playRecording = async (recordingId) => {
    try {
      setPlayingId(recordingId);
      const response = await fetch(`http://localhost:8000/api/recordings/${recordingId}/audio`);
      const data = await response.json();

      const audio = new Audio(`data:audio/webm;base64,${data.audio}`);
      audio.onended = () => setPlayingId(null);
      audio.play();
    } catch (error) {
      console.error('Error playing recording:', error);
      setPlayingId(null);
    }
  };

  const deleteRecording = async (recordingId) => {
    if (window.confirm('Are you sure you want to delete this recording?')) {
      try {
        await fetch(`http://localhost:8000/api/recordings/${recordingId}`, {
          method: 'DELETE',
        });
        fetchRecordings();
      } catch (error) {
        console.error('Error deleting recording:', error);
      }
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="app-container">
      {/* Animated background */}
      <div className="animated-bg">
        <div className="gradient-orb gradient-1"></div>
        <div className="gradient-orb gradient-2"></div>
        <div className="gradient-orb gradient-3"></div>
      </div>

      <div className="content-wrapper">
        <header className="header">
          <div className="header-content">
            <div className="logo-section">
              <Brain className="logo-icon" />
              <h1 className="app-title">
                German AI Voice Trainer
                <Sparkles className="sparkle-icon" />
              </h1>
            </div>
            <p className="app-subtitle">Master German pronunciation with AI-powered feedback</p>
          </div>
        </header>

        <div className="glass-card recording-card">
          <div className="card-glow"></div>
          <div className="recording-content">
            <div className="mic-wrapper">
              <div className={`mic-ring ${isRecording ? 'recording' : ''}`}>
                <div className="mic-ring-inner"></div>
              </div>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`mic-button ${isRecording ? 'recording' : ''}`}
              >
                {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
            </div>

            <p className="recording-status">
              {isRecording ? 'Recording in progress...' : 'Click to start recording'}
            </p>
          </div>

          {/* Live Transcription */}
          {(isRecording || transcription) && (
            <div className="transcription-section">
              <h3 className="transcription-title">
                <Volume2 className="inline-icon" />
                Live AI Transcription
              </h3>
              <div className="transcription-box">
                <p className="transcription-text">
                  {transcription || (isTranscribing ? 'Listening to your German...' : 'Start speaking in German...')}
                </p>
                {isTranscribing && (
                  <div className="pulse-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Recordings List */}
        <div className="glass-card recordings-card">
          <h2 className="section-title">
            Your Learning Journey
            <span className="recordings-count">{recordings.length} recordings</span>
          </h2>

          {recordings.length === 0 ? (
            <div className="empty-state">
              <Mic className="empty-icon" />
              <p>No recordings yet. Start your German journey!</p>
            </div>
          ) : (
            <div className="recordings-list">
              {recordings.map((recording) => (
                <div key={recording.id} className="recording-item">
                  <div className="recording-info">
                    <p className="recording-date">{formatDate(recording.created_at)}</p>
                    {recording.transcription && (
                      <p className="recording-transcription">
                        <span className="transcription-label">AI Transcription:</span>
                        <span className="transcription-content">{recording.transcription}</span>
                      </p>
                    )}
                  </div>
                  <div className="recording-actions">
                    <button
                      onClick={() => playRecording(recording.id)}
                      className={`action-button play-button ${playingId === recording.id ? 'playing' : ''}`}
                      title="Play recording"
                    >
                      <Play size={18} />
                    </button>
                    <button
                      onClick={() => deleteRecording(recording.id)}
                      className="action-button delete-button"
                      title="Delete recording"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="footer">
          <p>Powered by advanced AI speech recognition</p>
          <p className="tech-note">Works best in Chrome or Edge • Backend required on port 8000</p>
        </footer>
      </div>
      </div> // <-- Add this missing closing tag here
)};


export default App;
