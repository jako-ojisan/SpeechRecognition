import React, { useState, useRef, useEffect } from "react";
import { Button, Container, Typography, Box } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import WaveSurfer from "wavesurfer.js";
import { useRecoilState } from "recoil";
import { currentFontSize } from "./atom.js";

const App = () => {
  const [isRecording, setIsRecording] = useState(false);
  const waveSurferRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunks = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const amplitudeRef = useRef(0);
  const [finalTranscriptHTML, setFinalTranscriptHTML] = useState("");
  const [interimTranscriptHTML, setInterimTranscriptHTML] = useState("");
  const [fontSize, setFontSize] = useRecoilState(currentFontSize);
  const maxFontSizeRef = useRef(0); // 各セッションごとの最大フォントサイズ
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!waveSurferRef.current) {
      waveSurferRef.current = WaveSurfer.create({
        container: "#waveform",
        waveColor: "red",
        progressColor: "purple",
      });
    }
  }, []);

  useEffect(() => {
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 1024; // スペクトログラム用にFFTサイズを大きく設定
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;

        const drawSpectrogram = () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const canvasCtx = canvas.getContext("2d");
            const width = canvas.width;
            const height = canvas.height;
            const sliceWidth = width / bufferLength;
            
            analyser.getByteFrequencyData(dataArray);

            // スペクトログラムのシフト
            const imageData = canvasCtx.getImageData(0, 0, width, height);
            canvasCtx.putImageData(imageData, -sliceWidth, 0);
            canvasCtx.clearRect(width - sliceWidth, 0, sliceWidth, height);

            // 新しいデータを描画
            for (let i = 0; i < bufferLength; i++) {
              const value = dataArray[i];
              const percent = value / 256;
              const y = Math.floor(percent * height);
              const color = `rgb(${value}, ${value}, ${255 - value})`;
              canvasCtx.fillStyle = color;
              canvasCtx.fillRect(width - sliceWidth, height - y, sliceWidth, y);
            }
          }
          requestAnimationFrame(drawSpectrogram);
        };

        drawSpectrogram();
      })
      .catch((err) => {
        console.error("Error accessing audio:", err);
      });
  }, []);

  const handleStopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsRecording(false);
  };

  const handleStartRecording = () => {
    audioChunks.current = [];
    maxFontSizeRef.current = 0; // セッションごとに最大フォントサイズをリセット

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptResult = event.results[i][0].transcript;

        // 各音声入力でフォントサイズを変更し、最大サイズを追跡
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        const maxAmplitude = Math.max(...dataArrayRef.current.map((val) => Math.abs(val - 128)));

        const curryFontSize = 16 + (maxAmplitude / 64) * 32;
        setFontSize(curryFontSize);

        // 最大フォントサイズを更新
        if (curryFontSize > maxFontSizeRef.current) {
          maxFontSizeRef.current = curryFontSize;
        }

        if (event.results[i].isFinal) {
          finalText += `<span style="font-size: ${maxFontSizeRef.current}px;">${transcriptResult}</span>`;
          maxFontSizeRef.current = 0; // セッションごとに最大フォントサイズをリセット
        } else {
          interimText += `<span style="font-size: ${curryFontSize}px;">${transcriptResult}</span>`;
        }
      }

      setInterimTranscriptHTML(interimText);
      setFinalTranscriptHTML((prev) => prev + finalText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current = recognition;
    recognition.start();

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks.current, { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(audioBlob);
        waveSurferRef.current.load(audioUrl);
      };

      mediaRecorder.start();
      setIsRecording(true);
    });
  };

  useEffect(() => {
    if (isRecording) {
      console.log("Recording started");
    } else {
      console.log("Recording stopped");
    }
  }, [isRecording]);

  return (
    <Container>
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        height="100vh"
        sx={{ overflowY: 'auto', padding: '20px' }} // スクロール可能にするためのスタイル
      >
        <Typography variant="h4">Voice Recognition App</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<MicIcon />}
          onClick={handleStartRecording}
          disabled={isRecording}
          sx={{ mt: 3 }}
        >
          Start Recording
        </Button>
        <Button
          variant="contained"
          color="secondary"
          onClick={handleStopRecording}
          disabled={!isRecording}
          sx={{ mt: 2 }}
        >
          Stop Recording
        </Button>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Transcription:</Typography>
          <Typography
            variant="body1"
            style={{ transition: "font-size 0.2s" }}
            dangerouslySetInnerHTML={{ __html: finalTranscriptHTML + interimTranscriptHTML }}
          />
        </Box>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Amplitude:</Typography>
          <Typography variant="body1" style={{ fontSize: "24px", color: "red" }}>
            {amplitudeRef.current.toFixed(2)}
          </Typography>
        </Box>
        <Box sx={{ mt: 4, width: "100%" }}>
          <Typography variant="h6">Waveform:</Typography>
          <div id="waveform" style={{ width: "100%", height: "200px" }}></div>
        </Box>
        <Box sx={{ mt: 4, width: "100%", height: "200px" }}>
          <Typography variant="h6">Spectrogram:</Typography>
          <canvas ref={canvasRef} width="800" height="200" style={{ width: "100%", height: "200px", backgroundColor: "black" }} />
        </Box>
      </Box>
    </Container>
  );
};

export default App;
