require("dotenv").config({
  path: "/home/pi/dev/dos-title-screens/.env"
});
const Twitter = require("twitter");
const fs = require("fs");
const path = require("path");

const TWITTER_AUTH = {
  consumer_key: process.env.TWITTER_CONSUMER_KEY,
  consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
  access_token_key: process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret: process.env.TWITTER_ACCESS_SECRET
};

function main() {
  new TwitterBot(TWITTER_AUTH);
}

class ErrorLog {
  static Write(msg, err) {
    let fd = fs.openSync(process.env.ERROR_LOG, "a");
    fs.writeSync(fd, `${Date()}\n`);
    fs.writeSync(fd, `${msg}\n`);
    fs.writeSync(fd, `${JSON.stringify(err, null, 2)}\n`);
    fs.closeSync(fd);
  }
}

class TwitterBot {
  constructor(auth) {
    // initialize Twitter API
    this.Twitter = new Twitter(auth);

    // read image database if possible from disk
    try {
      this.ImageDatabase = this.ReadDatabaseFromFile(process.env.IMAGE_DATABASE_FILE);
    } catch (err) {
      // initializes new image database
      this.ImageDatabase = this.BuildImageDatabase(process.env.IMAGE_DIRECTORY);
      this.WriteDatabaseToFile(process.env.IMAGE_DATABASE_FILE);
    }

    // post an image
    this.BotCallback();
  }

  ReadDatabaseFromFile(infile) {
    let input = fs.readFileSync(infile);
    return JSON.parse(input);
  }

  BuildImageDatabase(path) {
    let fileNames = fs.readdirSync(path);
    return fileNames.map((name, index) => ({ filename: name, posted: false, index: index }));
  }

  WriteDatabaseToFile(outfile) {
    fs.writeFileSync(outfile, JSON.stringify(this.ImageDatabase));
  }

  // Resets all images as not posted
  ResetImageDatabase() {
    for (let i = 0; i < this.ImageDatabase.length; i++) {
      this.ImageDatabase[i].posted = false;
    }
  }

  // main process
  BotCallback() {
    // pick a random image
    let img = this.PickRandomImage();
    // post it to twitter
    this.PostToTwitter(img);
    // mark the image as posted
    this.MarkAsPosted(img);
  }

  PickRandomImage() {
    // filter for unposted images
    let unposted = this.ImageDatabase.filter(img => (!img.posted));
    // we've run out of unposted images, reset all as unposted
    if (unposted.length == 0) {
      // reset image post statuses
      // no need to write DB to disk, will be written after image post is complete
      this.ResetImageDatabase();
      unposted = this.ImageDatabase;
    }
    // pick a random image and return it
    let randomIndex = Math.floor(Math.random() * unposted.length);
    return unposted[randomIndex];
  }

  // uses Twitter API to upload image and update status
  PostToTwitter(img) {
    let data = fs.readFileSync(path.resolve(process.env.IMAGE_DIRECTORY, img.filename));

    this.Twitter.post("media/upload", { media: data }, (err, media) => {
      if (err) {
        ErrorLog.Write("Failure uploading media.", err);
        return;
      }

      let status = {
        status: img.filename + "\n#dosgaming #retrogaming",
        media_ids: media.media_id_string
      }

      this.Twitter.post("statuses/update", status, (err) => {
        if (err) {
          ErrorLog.Write("Failure updating status.", err);
        }
      });
    });
  }

  MarkAsPosted(img) {
    this.ImageDatabase[img.index].posted = true;
    this.WriteDatabaseToFile(process.env.IMAGE_DATABASE_FILE);
  }
}

main();
