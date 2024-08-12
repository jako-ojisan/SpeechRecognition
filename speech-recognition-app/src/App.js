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
  const [amplitude, setAmplitude] = useState(0); // amplitude のステートを追加
  const [finalTranscriptHTML, setFinalTranscriptHTML] = useState("");
  const [interimTranscriptHTML, setInterimTranscriptHTML] = useState("");
  const [fontSize, setFontSize] = useRecoilState(currentFontSize);
  const maxFontSizeRef = useRef(0);
  const canvasRef = useRef(null);
  const barChartCanvasRef = useRef(null);

  useEffect(() => {
    if (!waveSurferRef.current) {
      waveSurferRef.current = WaveSurfer.create({
        container: "#waveform",
        waveColor: "#00BFFF", // 空色に変更
        progressColor: "#87CEFA", // 空色の別のトーンに変更
        backgroundColor: "black",
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
        analyser.fftSize = 1024;
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
            const sliceWidth = 2;

            analyser.getByteFrequencyData(dataArray);

            const imageData = canvasCtx.getImageData(sliceWidth, 0, width - sliceWidth, height);
            canvasCtx.putImageData(imageData, 0, 0);

            canvasCtx.clearRect(width - sliceWidth, 0, sliceWidth, height);
            for (let i = 0; i < bufferLength; i++) {
              const value = dataArray[i];
              const percent = value / 256;
              const y = Math.floor(percent * height);
              const color = `rgb(0, ${value}, 255)`; // 空色ベースに変更
              canvasCtx.fillStyle = color;
              canvasCtx.fillRect(width - sliceWidth, height - y, sliceWidth, y);
            }
          }
          requestAnimationFrame(drawSpectrogram);
        };

        const drawBarChart = () => {
          const canvas = barChartCanvasRef.current;
          if (canvas) {
            const canvasCtx = canvas.getContext("2d");
            const width = canvas.width;
            const height = canvas.height;
            const barWidth = width / bufferLength;

            analyser.getByteFrequencyData(dataArray);

            canvasCtx.clearRect(0, 0, width, height);

            for (let i = 0; i < bufferLength; i++) {
              const value = dataArray[i];
              const percent = value / 256;
              const barHeight = percent * height;
              const color = `rgb(0, ${value}, 255)`; // 空色ベースに変更
              canvasCtx.fillStyle = color;
              canvasCtx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
            }
          }
          requestAnimationFrame(drawBarChart);
        };

        const updateAmplitude = () => {
          analyser.getByteTimeDomainData(dataArray);
          const maxAmplitude = Math.max(...dataArray.map((val) => Math.abs(val - 128)));
          setAmplitude(maxAmplitude / 128); // amplitude の更新
          requestAnimationFrame(updateAmplitude);
        };

        drawSpectrogram();
        drawBarChart();
        updateAmplitude(); // amplitude の更新を開始
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
    maxFontSizeRef.current = 0;

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

        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        const maxAmplitude = Math.max(...dataArrayRef.current.map((val) => Math.abs(val - 128)));

        const curryFontSize = 16 + (maxAmplitude / 64) * 32;
        setFontSize(curryFontSize);

        if (curryFontSize > maxFontSizeRef.current) {
          maxFontSizeRef.current = curryFontSize;
        }

        if (event.results[i].isFinal) {
          finalText += `<span style="font-size: ${maxFontSizeRef.current}px; color: #FFDAB9;">${transcriptResult}</span>`; // 温白色のテキスト
          maxFontSizeRef.current = 0;
        } else {
          interimText += `<span style="font-size: ${curryFontSize}px; color: #FFDAB9;">${transcriptResult}</span>`; // 温白色のテキスト
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
    <Container
      sx={{
        backgroundColor: "#191414", // 黒に近い背景色
        color: "white", // 白いテキスト
        paddingTop: "20px",
        paddingBottom: "20px",
      }}
    >
      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="center" 
        justifyContent="center" 
        sx={{ 
          height: "100%", 
          padding: '60px',  
          overflowY: 'auto' 
        }} 
      >
        <Typography variant="h4" sx={{ color: "#00BFFF" }}>Voice Recognition App</Typography>
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            onClick={handleStartRecording}
            disabled={isRecording}
            sx={{
              mr: 2,
              backgroundColor: "#00BFFF", // 空色のボタン
              "&:hover": {
                backgroundColor: "#87CEFA", // ホバー時の色を調整
              },
            }}
            startIcon={<MicIcon />}
          >
            Start Recording
          </Button>
          <Button
            variant="contained"
            onClick={handleStopRecording}
            disabled={!isRecording}
            sx={{
              backgroundColor: "#00BFFF", // 空色のボタン
              "&:hover": {
                backgroundColor: "#87CEFA", // ホバー時の色を調整
              },
            }}
          >
            Stop Recording
          </Button>
        </Box>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ color: "#00BFFF" }}>Transcription:</Typography>
          <Typography
            variant="body1"
            style={{ transition: "font-size 0.2s", color: "#FFDAB9" }} // 温白色のテキスト
            dangerouslySetInnerHTML={{ __html: finalTranscriptHTML + interimTranscriptHTML }}
          />
        </Box>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" sx={{ color: "#00BFFF" }}>Amplitude:</Typography>
          <Typography variant="body1" style={{ fontSize: "24px", color: "#00BFFF" }}>
            {amplitude.toFixed(2)} {/* amplitude を表示 */}
          </Typography>
        </Box>
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between', width: "100%" }}>
          <Box sx={{ width: "49%", height: "100px" }}>
            <Typography variant="h6" sx={{ color: "#00BFFF" }}>Spectrogram:</Typography>
            <canvas ref={canvasRef} width="400" height="100" style={{ width: "100%", height: "100px", backgroundColor: "black" }} />
          </Box>
          <Box sx={{ width: "49%", height: "100px" }}>
            <Typography variant="h6" sx={{ color: "#00BFFF" }}>Bar Chart:</Typography>
            <canvas ref={barChartCanvasRef} width="400" height="100" style={{ width: "100%", height: "100px", backgroundColor: "black" }} />
          </Box>
        </Box>
        <Box sx={{ mt: 4, width: "100%" }}>
          <Typography variant="h6" sx={{ color: "#00BFFF" }}>Waveform:</Typography>
          <div id="waveform" style={{ width: "100%", height: "200px" }}></div>
        </Box>
      </Box>
    </Container>
  );
};

export default App;
