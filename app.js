const express = require("express");
const app = express();
const csrf = require("tiny-csrf");
const cookieParser = require("cookie-parser");
const {
  Admin,
  Election,
  Questions,
  Options,
  Voter,
  Answer,
} = require("./models");
const bodyParser = require("body-parser");
const path = require("path");
const bcrypt = require("bcrypt");
const passport = require("passport");
const connectEnsureLogin = require("connect-ensure-login");
const session = require("express-session");
const flash = require("connect-flash");
const LocalStratergy = require("passport-local");

const saltRounds = 10;

app.set("views", path.join(__dirname, "views"));
app.use(flash());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser("Some secret String"));
app.use(csrf("this_should_be_32_character_long", ["POST", "PUT", "DELETE"]));

app.use(
  session({
    secret: "my-super-secret-key-2837428907583420",
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);
app.use((request, response, next) => {
  response.locals.messages = request.flash();
  next();
});
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  "Admin",
  new LocalStratergy(
    {
      usernameField: "email",
      passwordField: "password",
    },
    (username, password, done) => {
      Admin.findOne({ where: { email: username } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            done(null, false, { message: "Invalid password" });
          }
        })
        .catch((err) => {
          console.log(err);
          return done(null, false, { message: "Invalid Email-ID" });
        });
    }
  )
);

passport.use(
  "Voter",
  new LocalStratergy(
    {
      usernameField: "voterid",
      passwordField: "password",
      passReqToCallback: true,
    },
    async (request, username, password, done) => {
      const election = await Election.getElectionURL(request.params.urlString);
      Voter.findOne({ where: { voterid: username, electionID: election.id } })
        .then(async (user) => {
          const result = await bcrypt.compare(password, user.password);
          if (result) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Invalid password" });
          }
        })
        .catch(() => {
          return done(null, false, { message: "Invalid Voter-ID" });
        });
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, { id: user.id, role: user.role });
});
passport.deserializeUser((id, done) => {
  if (id.role === "admin") {
    Admin.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        done(error, null);
      });
  } else if (id.role === "voter") {
    Voter.findByPk(id.id)
      .then((user) => {
        done(null, user);
      })
      .catch((error) => {
        done(error, null);
      });
  }
});

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

//landing page
app.get("/", (request, response) => {
  if (request.user) {
    if (request.user.role === "admin") {
      return response.redirect("/elections");
    } else if (request.user.role === "voter") {
      request.logout((err) => {
        if (err) {
          return response.json(err);
        }
        response.redirect("/");
      });
    }
  } else {
    response.render("index", {
      title: "Online Voting Platform",
      csrfToken: request.csrfToken(),
    });
  }
});

//elections home page
app.get(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      let loggedinuser = request.user.firstName + " " + request.user.lastName;
      try {
        const elections = await Election.getElections(request.user.id);
        if (request.accepts("html")) {
          response.render("elections", {
            title: "Online Voting Platform",
            userName: loggedinuser,
            elections,
          });
        } else {
          return response.json({
            elections,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//signup page
app.get("/signup", (request, response) => {
  response.render("signup", {
    title: "Create admin account",
    csrfToken: request.csrfToken(),
  });
});

//create user account
app.post("/admin", async (request, response) => {
  if (!request.body.firstName) {
    request.flash("error", "Please enter your first name");
    return response.redirect("/signup");
  }
  if (!request.body.email) {
    request.flash("error", "Please enter email ID");
    return response.redirect("/signup");
  }
  if (!request.body.password) {
    request.flash("error", "Please enter your password");
    return response.redirect("/signup");
  }
  if (request.body.password.length < 8) {
    request.flash("error", "Password length should be atleast 8");
    return response.redirect("/signup");
  }
  const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
  try {
    const user = await Admin.createAdmin({
      firstName: request.body.firstName,
      lastName: request.body.lastName,
      email: request.body.email,
      password: hashedPwd,
    });
    request.login(user, (err) => {
      if (err) {
        console.log(err);
        response.redirect("/");
      } else {
        response.redirect("/elections");
      }
    });
  } catch (error) {
    request.flash("error", "Email ID is already in use");
    return response.redirect("/signup");
  }
});

//login page
app.get("/login", (request, response) => {
  if (request.user) {
    return response.redirect("/elections");
  }
  response.render("login", {
    title: "Login to your account",
    csrfToken: request.csrfToken(),
  });
});

//voter login page
app.get("/e/:urlString/voter", async (request, response) => {
  try {
    if (request.user) {
      return response.redirect(`/e/${request.params.urlString}`);
    }
    const election = await Election.getElectionURL(request.params.urlString);
    if (election.running && !election.ended) {
      return response.render("voter_login", {
        title: "Login in as Voter",
        urlString: request.params.urlString,
        electionID: election.id,
        csrfToken: request.csrfToken(),
      });
    } else {
      request.flash("Election has ended");
      return response.render("result");
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

//login user
app.post(
  "/session",
  passport.authenticate("Admin", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (request, response) => {
    response.redirect("/elections");
  }
);

//login voter
app.post(
  "/e/:urlString/voter",
  passport.authenticate("Voter", {
    failureFlash: true,
    failureRedirect: "back",
  }),
  async (request, response) => {
    return response.redirect(`/e/${request.params.urlString}`);
  }
);

//signout
app.get("/signout", (request, response, next) => {
  request.logout((err) => {
    if (err) {
      return next(err);
    }
    response.redirect("/");
  });
});

//password reset page
app.get(
  "/password-reset",
  connectEnsureLogin.ensureLoggedIn(),
  (request, response) => {
    if (request.user.role === "admin") {
      response.render("password-reset", {
        title: "Reset your password",
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//reset user password
app.post(
  "/password-reset",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.old_password) {
        request.flash("error", "Please enter your old password");
        return response.redirect("/password-reset");
      }
      if (!request.body.new_password) {
        request.flash("error", "Please enter a new password");
        return response.redirect("/password-reset");
      }
      if (request.body.new_password.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect("/password-reset");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.new_password,
        saltRounds
      );
      const result = await bcrypt.compare(
        request.body.old_password,
        request.user.password
      );
      if (result) {
        try {
          Admin.findOne({ where: { email: request.user.email } }).then(
            (user) => {
              user.resetPass(hashedNewPwd);
            }
          );
          request.flash("success", "Password changed successfully");
          return response.redirect("/elections");
        } catch (error) {
          console.log(error);
          return response.status(422).json(error);
        }
      } else {
        request.flash("error", "Old password does not match");
        return response.redirect("/password-reset");
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//new election page
app.get(
  "/elections/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      return response.render("new_election", {
        title: "Create an election",
        csrfToken: request.csrfToken(),
      });
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//creating new election
app.post(
  "/elections",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (request.body.electionName.length < 5) {
        request.flash("error", "Election name length should be atleast 5");
        return response.redirect("/elections/create");
      }
      if (request.body.urlString.length < 3) {
        request.flash("error", "URL String length should be atleast 3");
        return response.redirect("/elections/create");
      }
      if (
        request.body.urlString.includes(" ") ||
        request.body.urlString.includes("\t") ||
        request.body.urlString.includes("\n")
      ) {
        request.flash("error", "URL String cannot contain spaces");
        return response.redirect("/elections/create");
      }
      try {
        await Election.addElection({
          electionName: request.body.electionName,
          urlString: request.body.urlString,
          adminID: request.user.id,
        });
        return response.redirect("/elections");
      } catch (error) {
        request.flash("error", "Election URL is already in use");
        return response.redirect("/elections/create");
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//election page
app.get(
  "/elections/:id",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.id);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.ended) {
          return response.render("result");
        }
        const numberOfQuestions = await Questions.getNumberOfQuestions(
          request.params.id
        );
        const numberOfVoters = await Voter.getNumberOfVoters(request.params.id);
        return response.render("election_page", {
          id: request.params.id,
          title: election.electionName,
          urlString: election.urlString,
          running: election.running,
          nq: numberOfQuestions,
          nv: numberOfVoters,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//manage questions page
app.get(
  "/elections/:id/questions",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.id);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        const questions = await Questions.getQuestions(request.params.id);
        if (!election.running && !election.ended) {
          if (request.accepts("html")) {
            return response.render("questions", {
              title: election.electionName,
              id: request.params.id,
              questions: questions,
              csrfToken: request.csrfToken(),
            });
          } else {
            return response.json({
              questions,
            });
          }
        } else {
          if (election.ended) {
            request.flash("error", "Cannot edit when election has ended");
          } else if (election.running) {
            request.flash("error", "Cannot edit while election is running");
          }
          return response.redirect(`/elections/${request.params.id}/`);
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//add question page
app.get(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.id);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (!election.running) {
          return response.render("new_question", {
            id: request.params.id,
            csrfToken: request.csrfToken(),
          });
        } else {
          if (election.ended) {
            request.flash("error", "Cannot edit when election has ended");
            return response.redirect(`/elections/${request.params.id}/`);
          }
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//add question
app.post(
  "/elections/:id/questions/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (request.body.question.length < 5) {
        request.flash("error", "Question length should be atleast 5");
        return response.redirect(
          `/elections/${request.params.id}/questions/create`
        );
      }

      try {
        const election = await Election.getElection(request.params.id);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await Questions.addQuestion({
          question: request.body.question,
          description: request.body.description,
          electionID: request.params.id,
        });
        return response.redirect(
          `/elections/${request.params.id}/questions/${question.id}`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//edit question page
app.get(
  "/elections/:electionID/questions/:questionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const question = await Questions.getQuestion(request.params.questionID);
        return response.render("edit_question", {
          electionID: request.params.electionID,
          questionID: request.params.questionID,
          questionTitle: question.question,
          questionDescription: question.description,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//edit question
app.put(
  "/elections/:electionID/questions/:questionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (request.body.question.length < 5) {
        request.flash("error", "Question length should be atleast 5");
        return response.json({
          error: "Question length should be atleast 5",
        });
      }
      try {
        const election = await Election.getElection(request.params.electionID);
        if (election.running) {
          return response.json("Cannot edit while election is running");
        }
        if (election.ended) {
          return response.json("Cannot edit when election has ended");
        }
        if (request.user.id !== election.adminID) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        const updatedQuestion = await Questions.updateQuestion({
          question: request.body.question,
          description: request.body.description,
          id: request.params.questionID,
        });
        return response.json(updatedQuestion);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//delete question
app.delete(
  "/elections/:electionID/questions/:questionID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (election.running) {
          return response.json("Cannot edit while election is running");
        }
        if (election.ended) {
          return response.json("Cannot edit when election has ended");
        }
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        const nq = await Questions.getNumberOfQuestions(
          request.params.electionID
        );
        if (nq > 1) {
          const res = await Questions.deleteQuestion(request.params.questionID);
          return response.json({ success: res === 1 });
        } else {
          return response.json({ success: false });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//question page
app.get(
  "/elections/:id/questions/:questionID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const question = await Questions.getQuestion(request.params.questionID);
        const options = await Options.getOptions(request.params.questionID);
        const election = await Election.getElection(request.params.id);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (request.accepts("html")) {
          response.render("question_page", {
            title: question.question,
            description: question.description,
            id: request.params.id,
            questionID: request.params.questionID,
            options,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            options,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//adding options
app.post(
  "/elections/:id/questions/:questionID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please enter option");
        return response.redirect(
          `/elections/${request.params.id}/questions/${request.params.questionID}`
        );
      }
      try {
        const election = await Election.getElection(request.params.id);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        await Options.addOption({
          option: request.body.option,
          questionID: request.params.questionID,
        });
        return response.redirect(
          `/elections/${request.params.id}/questions/${request.params.questionID}`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//delete options
app.delete(
  "/elections/:electionID/questions/:questionID/options/:optionID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          return response.json("Cannot edit while election is running");
        }
        if (election.ended) {
          return response.json("Cannot edit when election has ended");
        }
        const res = await Options.deleteOption(request.params.optionID);
        return response.json({ success: res === 1 });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//edit option page
app.get(
  "/elections/:electionID/questions/:questionID/options/:optionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          request.flash("error", "Cannot edit while election is running");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.id}/`);
        }
        const option = await Options.getOption(request.params.optionID);
        return response.render("edit_option", {
          option: option.option,
          csrfToken: request.csrfToken(),
          electionID: request.params.electionID,
          questionID: request.params.questionID,
          optionID: request.params.optionID,
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//update options
app.put(
  "/elections/:electionID/questions/:questionID/options/:optionID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.option) {
        request.flash("error", "Please enter option");
        return response.json({
          error: "Please enter option",
        });
      }
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.running) {
          return response.json("Cannot edit while election is running");
        }
        if (election.ended) {
          return response.json("Cannot edit when election has ended");
        }
        const updatedOption = await Options.updateOption({
          id: request.params.optionID,
          option: request.body.option,
        });
        return response.json(updatedOption);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//voter page
app.get(
  "/elections/:electionID/voters",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const voters = await Voter.getVoters(request.params.electionID);
        const election = await Election.getElection(request.params.electionID);
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.electionID}/`);
        }
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (request.accepts("html")) {
          return response.render("voters", {
            title: election.electionName,
            id: request.params.electionID,
            voters,
            csrfToken: request.csrfToken(),
          });
        } else {
          return response.json({
            voters,
          });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//add voter page
app.get(
  "/elections/:electionID/voters/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.electionID}/`);
        }
        response.render("new_voter", {
          title: "Add a voter to election",
          electionID: request.params.electionID,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//add voter
app.post(
  "/elections/:electionID/voters/create",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.voterid) {
        request.flash("error", "Please enter voterID");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
      if (!request.body.password) {
        request.flash("error", "Please enter password");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
      if (request.body.password.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
      const hashedPwd = await bcrypt.hash(request.body.password, saltRounds);
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.electionID}/`);
        }
        await Voter.createVoter({
          voterid: request.body.voterid,
          password: hashedPwd,
          electionID: request.params.electionID,
        });
        return response.redirect(
          `/elections/${request.params.electionID}/voters`
        );
      } catch (error) {
        request.flash("error", "Voter ID already in use");
        return response.redirect(
          `/elections/${request.params.electionID}/voters/create`
        );
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//delete voter
app.delete(
  "/elections/:electionID/voters/:voterID",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        if (election.ended) {
          return response.json("Cannot edit when election has ended");
        }
        const nv = await Voter.getNumberOfVoters(request.params.electionID);
        if (nv > 1) {
          const voter = await Voter.getVoter(request.params.voterID);
          if (voter.voted) {
            return response.json("Voter has already voted, Cannot delete now");
          }
          const res = await Voter.deleteVoter(request.params.voterID);
          return response.json({ success: res === 1 });
        } else {
          return response.json({ success: false });
        }
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//voter password reset page
app.get(
  "/elections/:electionID/voters/:voterID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        const voter = await Voter.getVoter(request.params.voterID);
        if (voter.voted) {
          request.flash("error", "Voter has already submitted their vote");
          return response.redirect(
            `/elections/${request.params.electionID}/voters`
          );
        }
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.electionID}/`);
        }
        response.render("voter_password", {
          title: "Reset voter password",
          electionID: request.params.electionID,
          voterID: request.params.voterID,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//reset user password
app.post(
  "/elections/:electionID/voters/:voterID/edit",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      if (!request.body.new_password) {
        request.flash("error", "Please enter a new password");
        return response.redirect("/password-reset");
      }
      if (request.body.new_password.length < 8) {
        request.flash("error", "Password length should be atleast 8");
        return response.redirect("/password-reset");
      }
      const hashedNewPwd = await bcrypt.hash(
        request.body.new_password,
        saltRounds
      );
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.electionID}/`);
        }
        Voter.findOne({ where: { id: request.params.voterID } }).then(
          (user) => {
            user.resetPass(hashedNewPwd);
          }
        );
        request.flash("success", "Password changed successfully");
        return response.redirect(
          `/elections/${request.params.electionID}/voters`
        );
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//election preview
app.get(
  "/elections/:electionID/preview",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          request.flash("error", "Invalid election ID");
          return response.redirect("/elections");
        }
        if (election.ended) {
          request.flash("error", "Cannot edit when election has ended");
          return response.redirect(`/elections/${request.params.electionID}/`);
        }
        const voters_count = await Voter.getNumberOfVoters(
          request.params.electionID
        );
        const questions = await Questions.getQuestions(
          request.params.electionID
        );
        let options = [];
        for (let question in questions) {
          const question_options = await Options.getOptions(
            questions[question].id
          );
          if (question_options.length < 2) {
            request.flash(
              "error",
              "There should be atleast two options in each question"
            );
            request.flash(
              "error",
              "Please add atleast two options to the question below"
            );
            return response.redirect(
              `/elections/${request.params.electionID}/questions/${questions[question].id}`
            );
          }
          options.push(question_options);
        }

        if (questions.length < 1) {
          request.flash(
            "error",
            "Please add atleast one question in the ballot"
          );
          return response.redirect(
            `/elections/${request.params.electionID}/questions`
          );
        }

        if (voters_count < 1) {
          request.flash(
            "error",
            "Please add atleast one voter to the election"
          );
          return response.redirect(
            `/elections/${request.params.electionID}/voters`
          );
        }

        return response.render("vote_preview", {
          title: election.electionName,
          electionID: request.params.electionID,
          questions,
          options,
          csrfToken: request.csrfToken(),
        });
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//launch an election
app.put(
  "/elections/:electionID/launch",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        if (election.ended) {
          return response.json("Cannot launch when election has ended");
        }
        const launchedElection = await Election.launchElection(
          request.params.electionID
        );
        return response.json(launchedElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

//end an election
app.put(
  "/elections/:electionID/end",
  connectEnsureLogin.ensureLoggedIn(),
  async (request, response) => {
    if (request.user.role === "admin") {
      try {
        const election = await Election.getElection(request.params.electionID);
        if (request.user.id !== election.adminID) {
          return response.json({
            error: "Invalid Election ID",
          });
        }
        if (!election.running) {
          return response.json("Cannot end when election hasn't launched yet");
        }
        const endElection = await Election.endElection(
          request.params.electionID
        );
        return response.json(endElection);
      } catch (error) {
        console.log(error);
        return response.status(422).json(error);
      }
    } else if (request.user.role === "voter") {
      return response.redirect("/");
    }
  }
);

app.get("/e/:urlString/", async (request, response) => {
  if (!request.user) {
    request.flash("error", "Please login before trying to Vote");
    return response.redirect(`/e/${request.params.urlString}/voter`);
  }
  if (request.user.voted) {
    request.flash("error", "You have voted successfully");
    return response.redirect(`/e/${request.params.urlString}/results`);
  }
  try {
    const election = await Election.getElectionURL(request.params.urlString);
    if (election.ended) {
      return response.redirect(`/elections/${request.params.id}/result`);
    }
    if (request.user.role === "voter") {
      if (election.running) {
        const questions = await Questions.getQuestions(election.id);
        let options = [];
        for (let question in questions) {
          options.push(await Options.getOptions(questions[question].id));
        }
        return response.render("vote", {
          title: election.electionName,
          electionID: election.id,
          questions,
          options,
          urlString: request.params.urlString,
          csrfToken: request.csrfToken(),
        });
      } else {
        return response.render("404");
      }
    } else if (request.user.role === "admin") {
      request.flash("error", "You cannot vote as Admin");
      request.flash("error", "Please signout as Admin before trying to vote");
      return response.redirect(`/elections/${election.id}`);
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.post("/e/:urlString", async (request, response) => {
  if (!request.user) {
    request.flash("error", "Please login before trying to Vote");
    return response.redirect(`/e/${request.params.urlString}/voter`);
  }
  if (request.user.voted) {
    request.flash("error", "You have voted successfully");
    return response.redirect(`/e/${request.params.urlString}/results`);
  }
  try {
    let election = await Election.getElectionURL(request.params.urlString);
    if (election.ended) {
      request.flash("error", "Cannot vote when election has ended");
      return response.redirect(`/elections/${request.params.id}/results`);
    }
    let questions = await Questions.getQuestions(election.id);
    for (let question of questions) {
      let qid = `q-${question.id}`;
      let selectedOption = request.body[qid];
      await Answer.addAnswer({
        voterID: request.user.id,
        electionID: election.id,
        questionID: question.id,
        selectedOption: selectedOption,
      });
      await Voter.markAsVoted(request.user.id);
      return response.redirect(`/e/${request.params.urlString}/results`);
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.get("/e/:urlString/results", async (request, response) => {
  if (!request.user) {
    request.flash("error", "Please login before viewing results");
    return response.redirect(`/e/${request.params.urlString}/voter`);
  }
  try {
    const election = await Election.getElectionURL(request.params.urlString);
    if (request.user.role === "voter") {
      if (!election.ended) {
        return response.render("thankyou");
      }
      if (!request.user.voted) {
        request.flash("error", "You have not completed your vote");
        request.flash("error", "Please vote to view results");
        return response.redirect(`/e/${request.params.urlString}`);
      }
      return response.render("result");
    } else if (request.user.role === "admin") {
      if (request.user.id !== election.adminID) {
        request.flash("error", "Invalid election ID");
        return response.redirect("/elections");
      }
      return response.render("result");
    }
  } catch (error) {
    console.log(error);
    return response.status(422).json(error);
  }
});

app.use(function (request, response) {
  response.status(404).render("404");
});

module.exports = app;
