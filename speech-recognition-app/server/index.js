const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

app.post('/save-transcript', (req, res) => {
  const { transcript } = req.body;
  // ここに保存処理を追加
  console.log(transcript);
  res.sendStatus(200);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
