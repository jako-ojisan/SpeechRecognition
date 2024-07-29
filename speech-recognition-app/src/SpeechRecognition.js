import React, { useState } from 'react';
import { IconButton, TextField } from '@mui/material';
import MicIcon from '@mui/icons-material/Mic';
import { styled } from '@mui/system';

const CustomTextField = styled(TextField)({
  '& .MuiInputBase-input': {
    color: 'white', // 文字色を青色に設定
  },
  '& .MuiInputLabel-root': {
    color: 'white', // ラベルの色を青色に設定
  },
  '& .MuiOutlinedInput-root .MuiOutlinedInput-notchedOutline': {
    borderColor: 'white', // 枠の色を青色に設定
  },
});

const SpeechRecognitionComponent = () => {
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startRecording = () => {
    setRecording(true);
    console.log('Recording started...');

    if (!('webkitSpeechRecognition' in window)) {
      alert('Web Speech API is not supported by this browser. Please use Google Chrome.');
      return;
    }

    const recognition = new window.webkitSpeechRecognition();
    recognition.lang = 'ja-JP';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const speechResult = event.results[0][0].transcript;
      console.log('Speech result:', speechResult);
      setTranscript(speechResult);
      setRecording(false);
    };

    recognition.onaudioend = () => {
      console.log('Audio ended.');
      setRecording(false);
    };

    recognition.onerror = (event) => {
      console.error('Recognition error:', event.error);
      setRecording(false);
    };

    recognition.onend = () => {
      console.log('Recognition ended.');
      setRecording(false);
    };

    recognition.start();

    setTimeout(() => {
      recognition.stop();
    }, 10000); // 10秒後に停止
  };

  return (
    <div>
      <CustomTextField
        fullWidth
        label="Transcription"
        value={transcript}
        InputProps={{
          readOnly: true,
        }}
        variant="outlined"
      />
      <IconButton
        color="primary"
        onClick={startRecording}
        disabled={recording}
      >
        <MicIcon />
      </IconButton>
    </div>
  );
};

export default SpeechRecognitionComponent;
