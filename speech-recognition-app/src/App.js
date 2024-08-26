import React, { useState, useRef, useEffect } from "react";
import { Button, Container, Typography, Box } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
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
  const [amplitude, setAmplitude] = useState(0);
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
        waveColor: "#87CEEB",
        progressColor: "#ADD8E6",
        backgroundColor: "black",
        height: 80,
        width: "100%",
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
              const color = `rgb(135, ${value}, 235)`;
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
              const color = `rgb(135, ${value}, 235)`;
              canvasCtx.fillStyle = color;
              canvasCtx.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
            }
          }
          requestAnimationFrame(drawBarChart);
        };

        const updateAmplitude = () => {
          analyser.getByteTimeDomainData(dataArray);
          const maxAmplitude = Math.max(...dataArray.map((val) => Math.abs(val - 128)));
          setAmplitude(maxAmplitude / 128);
          requestAnimationFrame(updateAmplitude);
        };

        drawSpectrogram();
        drawBarChart();
        updateAmplitude();
      })
      .catch((err) => {
        console.error("Error accessing audio:", err);
      });
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
    } else {
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
            finalText += `<span style="font-size: ${maxFontSizeRef.current}px; color: #FFDAB9;">${transcriptResult}</span>`;
            maxFontSizeRef.current = 0;
          } else {
            interimText += `<span style="font-size: ${curryFontSize}px; color: #FFDAB9;">${transcriptResult}</span>`;
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
    }
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
     maxWidth={false}
      sx={{
        backgroundColor: "#191414",
        color: "white",
        paddingTop: "1%",  
        paddingBottom: "10%",
        position: "relative",
        top: "-8%",  
        overflowX: "hidden",
        textAlign: "center",  
      }}
    >
      {/* SONARタイトル */}
      <Typography variant="h5" sx={{ color: "#00FFFF", marginBottom: "20px" }}>  {/* 蛍光色の青に設定 */}
        SONAR
      </Typography>

      <Box 
        display="flex" 
        flexDirection="column" 
        alignItems="flex-start"
        justifyContent="center" 
        sx={{ 
          height: "100%", 
          padding: '3%', 
          overflowX: "hidden",
          textAlign: "left",  
        }} 
      >
        {/* 左側のTranscription */}
        <Box 
          sx={{ 
            width: "55%",  
            marginBottom: "1%", 
            border: "0.2em solid #87CEEB", 
            borderRadius: "10px", 
            padding: "1%",
            height: "400px",  
            backgroundColor: "#282828", 
            marginTop: "-2%",  
          }}
        > 
          <Typography variant="h6" sx={{ color: "#87CEEB", marginBottom: "5px" }}>Transcription:</Typography>
          <Box
            sx={{
              height: "calc(100% - 32px)", 
              overflowY: "auto",
              padding: "1%",
              width: "100%",
            }}
          >
            <Typography
              variant="body1"
              style={{ transition: "font-size 0.2s", color: "#FFDAB9" }}
              dangerouslySetInnerHTML={{ __html: finalTranscriptHTML + interimTranscriptHTML }}
            />
          </Box>
        </Box>

        {/* 右側のSpectrogram, Bar Chart, Waveform */}
        <Box sx={{ width: "50%", marginLeft: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", marginTop: "-420px" }}> {/* グループ全体を少し上に移動 */}
          <Box 
            sx={{ 
              width: '60%', 
              marginBottom: "2%", 
              border: "0.2em solid #87CEEB", 
              padding: "1%", 
              borderRadius: "10px",
              height: "120px", 
            }}
          >
            <Typography variant="h6" sx={{ color: "#87CEEB", textAlign: 'left', marginBottom: "5px" }}>Spectrogram:</Typography>
            <canvas ref={canvasRef} style={{ width: "100%", height: "80px", backgroundColor: "black" }} />
          </Box>
          <Box 
            sx={{ 
              width: '60%', 
              marginBottom: "2%", 
              border: "0.2em solid #87CEEB", 
              padding: "1%", 
              borderRadius: "10px",
              height: "120px", 
            }}
          >
            <Typography variant="h6" sx={{ color: "#87CEEB", textAlign: 'left', marginBottom: "5px" }}>Bar Chart:</Typography>
            <canvas ref={barChartCanvasRef} style={{ width: "100%", height: "80px", backgroundColor: "black" }} />
          </Box>
          <Box 
            sx={{ 
              width: '60%', 
              marginBottom: "2%", 
              border: "0.2em solid #87CEEB", 
              padding: "1%", 
              borderRadius: "10px",
              height: "120px", 
            }}
          >
            <Typography variant="h6" sx={{ color: "#87CEEB", textAlign: 'left', marginBottom: "5px" }}>Waveform:</Typography>
            <div id="waveform" style={{ width: "100%", height: "80px" }}></div>
          </Box>
        </Box>
      </Box>
      <Box 
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          width: "100%",
          backgroundColor: "#282828",
          padding: "0.5% 1%", 
          display: "flex",
          justifyContent: "center", 
          alignItems: "center",
        }}
      >
        <Box 
          sx={{
            border: "0.2em solid #87CEEB",
            padding: "1% 2%", 
            borderRadius: "10px", 
            fontSize: "1em", 
            width: "25%", 
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginRight: "1%", 
          }}
        >
          <Typography variant="h6" sx={{ color: "#87CEEB", whiteSpace: "nowrap" }}>Font Size:</Typography>
          <Typography variant="body1" sx={{ fontSize: "0.9em", color: "#87CEEB", ml: "5%" }}>
            {fontSize.toFixed(2)} px
          </Typography>
        </Box>
        <Button
          variant="contained"
          onClick={toggleRecording}
          sx={{
            backgroundColor: isRecording ? "#FF7F7F" : "#87CEEB",
            border: `0.2em solid ${isRecording ? "#FF7F7F" : "#87CEEB"}`,
            width: "50px", 
            height: "50px",
            minWidth: "50px", 
            padding: 0, 
            borderRadius: "50%", 
            "&:hover": {
              backgroundColor: isRecording ? "#FF9999" : "#B0E0E6",
            },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: "1%", 
            marginRight: "1%", 
          }}
        >
          {isRecording ? <PauseIcon /> : <PlayArrowIcon />}
        </Button>
        <Box 
          sx={{
            border: "0.2em solid #87CEEB",
            padding: "1% 2%", 
            borderRadius: "10px", 
            fontSize: "1em", 
            width: "25%", 
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginLeft: "1%", 
          }}
        >
          <Typography variant="h6" sx={{ color: "#87CEEB", whiteSpace: "nowrap" }}>Amplitude:</Typography>
          <Typography variant="body1" sx={{ fontSize: "0.9em", color: "#87CEEB", ml: "5%" }}>
            {amplitude.toFixed(2)}
          </Typography>
        </Box>
      </Box>
    </Container>
  );
};

export default App;
