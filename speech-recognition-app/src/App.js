import React, { useState, useRef, useEffect } from "react";
import { Button, Container, Typography, Box } from "@mui/material";
import MicIcon from "@mui/icons-material/Mic";
import WaveSurfer from "wavesurfer.js";

const App = () => {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const waveSurferRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioChunks = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const dataArrayRef = useRef(null);
  const amplitudeRef = useRef(0);

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
        const audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        dataArrayRef.current = dataArray;

        const updateAmplitude = () => {
          analyser.getByteTimeDomainData(dataArray);
          const maxAmplitude = Math.max(
            ...dataArray.map((val) => Math.abs(val - 128))
          );
          amplitudeRef.current = maxAmplitude;
          requestAnimationFrame(updateAmplitude);
        };

        updateAmplitude();
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

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "ja-JP";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptResult = event.results[i][0].transcript;

        // 認識時点の振幅を取得
        analyserRef.current.getByteTimeDomainData(dataArrayRef.current);
        const maxAmplitude = Math.max(
          ...dataArrayRef.current.map((val) => Math.abs(val - 128))
        );
        const currentFontSize = 16 + (maxAmplitude / 128) * 32;

        if (event.results[i].isFinal) {
          // 最終結果の場合
          finalText += `<span style="font-size: ${currentFontSize}px;">${transcriptResult}</span>`;
        } else {
          // 中間結果の場合
          interimText += `<span style="font-size: ${currentFontSize}px;">${transcriptResult}</span>`;
        }
      }

      setInterimTranscript(interimText);
      setTranscript((prevTranscript) => prevTranscript + finalText);
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
            dangerouslySetInnerHTML={{ __html: transcript + interimTranscript }}
          />
        </Box>
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6">Amplitude:</Typography>
          <Typography
            variant="body1"
            style={{ fontSize: "24px", color: "red" }}
          >
            {amplitudeRef.current.toFixed(2)}
          </Typography>
        </Box>
        <Box sx={{ mt: 4, width: "100%" }}>
          <Typography variant="h6">Waveform:</Typography>
          <div id="waveform" style={{ width: "100%", height: "200px" }}></div>
        </Box>
      </Box>
    </Container>
  );
};

export default App;
