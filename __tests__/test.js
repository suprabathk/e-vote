const request = require("supertest");
const cheerio = require("cheerio");
const db = require("../models/index");
const app = require("../app");

let server, agent;

function extractCsrfToken(res) {
  var $ = cheerio.load(res.text);
  return $("[name=_csrf]").val();
}

const login = async (agent, username, password) => {
  let res = await agent.get("/login");
  let csrfToken = extractCsrfToken(res);
  res = await agent.post("/session").send({
    email: username,
    password: password,
    _csrf: csrfToken,
  });
};

describe("Online voting application", function () {
  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    server = app.listen(4040, () => {});
    agent = request.agent(server);
  });

  afterAll(async () => {
    try {
      await db.sequelize.close();
      await server.close();
    } catch (error) {
      console.log(error);
    }
  });

  test("Sign up", async () => {
    let res = await agent.get("/signup");
    const csrfToken = extractCsrfToken(res);
    res = await agent.post("/admin").send({
      firstName: "Test",
      lastName: "User A",
      email: "user.a@test.com",
      password: "12345678",
      _csrf: csrfToken,
    });
    expect(res.statusCode).toBe(302);
  });

  test("Sign in", async () => {
    const agent = request.agent(server);
    let res = await agent.get("/elections");
    expect(res.statusCode).toBe(302);
    await login(agent, "user.a@test.com", "12345678");
    res = await agent.get("/elections");
    expect(res.statusCode).toBe(200);
  });

  test("Sign out", async () => {
    let res = await agent.get("/elections");
    expect(res.statusCode).toBe(200);
    res = await agent.get("/signout");
    expect(res.statusCode).toBe(302);
    res = await agent.get("/elections");
    expect(res.statusCode).toBe(302);
  });

  test("Creating a election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");
    const res = await agent.get("/elections/create");
    const csrfToken = extractCsrfToken(res);
    const response = await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test1",
      _csrf: csrfToken,
    });
    expect(response.statusCode).toBe(302);
  });

  test("Adding a question", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test2",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    let response = await agent
      .post(`/elections/${latestElection.id}/questions/create`)
      .send({
        question: "Test question",
        description: "Test description",
        _csrf: csrfToken,
      });
    expect(response.statusCode).toBe(302);
  });

  test("Deleting a question", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test3",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedElectionsResponse = JSON.parse(
      groupedElectionsResponse.text
    );
    const electionCount = parsedGroupedElectionsResponse.elections.length;
    const latestElection =
      parsedGroupedElectionsResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question 1",
      description: "Test description 1",
      _csrf: csrfToken,
    });

    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question 2",
      description: "Test description 2",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/questions`);
    csrfToken = extractCsrfToken(res);
    const deleteResponse = await agent
      .delete(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
      });
    const parsedDeleteResponse = JSON.parse(deleteResponse.text).success;
    expect(parsedDeleteResponse).toBe(true);

    res = await agent.get(`/elections/${latestElection.id}/questions`);
    csrfToken = extractCsrfToken(res);

    const deleteResponse2 = await agent
      .delete(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
      });
    const parsedDeleteResponse2 = JSON.parse(deleteResponse2.text).success;
    expect(parsedDeleteResponse2).toBe(false);
  });

  test("Updating a question", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test4",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedElectionsResponse = JSON.parse(
      groupedElectionsResponse.text
    );
    const electionCount = parsedGroupedElectionsResponse.elections.length;
    const latestElection =
      parsedGroupedElectionsResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question 1",
      description: "Test description 1",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}/edit`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent.put(`/questions/${latestQuestion.id}/edit`).send({
      _csrf: csrfToken,
      question: "123",
      description: "456",
    });
    expect(res.statusCode).toBe(200);
  });

  test("Adding a option", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test5",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question",
      description: "Test description",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);

    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });
    expect(res.statusCode).toBe(302);
  });

  test("Deleting a option", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test6",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedElectionsResponse = JSON.parse(
      groupedElectionsResponse.text
    );
    const electionCount = parsedGroupedElectionsResponse.elections.length;
    const latestElection =
      parsedGroupedElectionsResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question 1",
      description: "Test description 1",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });

    const groupedOptionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .set("Accept", "application/json");
    const parsedOptionsGroupedResponse = JSON.parse(
      groupedOptionsResponse.text
    );
    const optionsCount = parsedOptionsGroupedResponse.options.length;
    const latestOption = parsedOptionsGroupedResponse.options[optionsCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    const deleteResponse = await agent
      .delete(`/options/${latestOption.id}`)
      .send({
        _csrf: csrfToken,
      });
    const parsedDeleteResponse = JSON.parse(deleteResponse.text).success;
    expect(parsedDeleteResponse).toBe(true);

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    const deleteResponse2 = await agent
      .delete(`/options/${latestOption.id}`)
      .send({
        _csrf: csrfToken,
      });
    const parsedDeleteResponse2 = JSON.parse(deleteResponse2.text).success;
    expect(parsedDeleteResponse2).toBe(false);
  });

  test("Updating a option", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test7",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedElectionsResponse = JSON.parse(
      groupedElectionsResponse.text
    );
    const electionCount = parsedGroupedElectionsResponse.elections.length;
    const latestElection =
      parsedGroupedElectionsResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question 1",
      description: "Test description 1",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });

    const groupedOptionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .set("Accept", "application/json");
    const parsedOptionsGroupedResponse = JSON.parse(
      groupedOptionsResponse.text
    );
    const optionsCount = parsedOptionsGroupedResponse.options.length;
    const latestOption = parsedOptionsGroupedResponse.options[optionsCount - 1];

    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}/options/${latestOption.id}/edit`
    );
    csrfToken = extractCsrfToken(res);

    res = await agent.put(`/options/${latestOption.id}/edit`).send({
      _csrf: csrfToken,
      option: "testoption",
    });
    expect(res.statusCode).toBe(200);
  });

  test("Adding a voter", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test8",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/voters/create`);
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/voters/create`)
      .send({
        voterid: "Test voter",
        password: "Test password",
        _csrf: csrfToken,
      });
    expect(res.statusCode).toBe(302);
  });

  test("Deleting a voter", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test9",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/voters/create`);
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/voters/create`)
      .send({
        voterid: "Test voter1",
        password: "Test password",
        _csrf: csrfToken,
      });

    const groupedVotersResponse = await agent
      .get(`/elections/${latestElection.id}/voters`)
      .set("Accept", "application/json");
    const parsedVotersGroupedResponse = JSON.parse(groupedVotersResponse.text);
    const votersCount = parsedVotersGroupedResponse.voters.length;
    const latestVoter = parsedVotersGroupedResponse.voters[votersCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/voters/`);
    csrfToken = extractCsrfToken(res);
    const deleteResponse = await agent
      .delete(`/elections/${latestElection.id}/voters/${latestVoter.id}`)
      .send({
        _csrf: csrfToken,
      });
    const parsedDeleteResponse = JSON.parse(deleteResponse.text).success;
    expect(parsedDeleteResponse).toBe(true);

    res = await agent.get(`/elections/${latestElection.id}/voters/`);
    csrfToken = extractCsrfToken(res);
    const deleteResponse2 = await agent
      .delete(`/elections/${latestElection.id}/voters/${latestVoter.id}`)
      .send({
        _csrf: csrfToken,
      });
    const parsedDeleteResponse2 = JSON.parse(deleteResponse2.text).success;
    expect(parsedDeleteResponse2).toBe(false);
  });

  test("Preview and Launch validation", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test10",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    res = await agent.get(`/elections/${latestElection.id}/preview`);
    csrfToken = extractCsrfToken(res);
    expect(res.statusCode).toBe(302);
  });

  test("Launch an election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test11",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question",
      description: "Test description",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    //adding option 1
    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });

    //adding option 2
    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });

    res = await agent.get(`/elections/${latestElection.id}/preview`);
    csrfToken = extractCsrfToken(res);

    //election is not running by default
    expect(latestElection.running).toBe(false);
    res = await agent.put(`/elections/${latestElection.id}/launch`).send({
      _csrf: csrfToken,
    });
    const launchedElectionRes = JSON.parse(res.text);
    expect(launchedElectionRes[1][0].running).toBe(true);

    res = await agent.get(`/e/${latestElection.urlString}`);
    expect(res.statusCode).toBe(200);
  });

  test("Cannot edit questions after launching election", async () => {
    const agent = request.agent(server);
    await login(agent, "user.a@test.com", "12345678");

    //create new election
    let res = await agent.get("/elections/create");
    let csrfToken = extractCsrfToken(res);
    await agent.post("/elections").send({
      electionName: "Test election",
      urlString: "test12",
      _csrf: csrfToken,
    });
    const groupedElectionsResponse = await agent
      .get("/elections")
      .set("Accept", "application/json");
    const parsedGroupedResponse = JSON.parse(groupedElectionsResponse.text);
    const electionCount = parsedGroupedResponse.elections.length;
    const latestElection = parsedGroupedResponse.elections[electionCount - 1];

    //add a question
    res = await agent.get(`/elections/${latestElection.id}/questions/create`);
    csrfToken = extractCsrfToken(res);
    await agent.post(`/elections/${latestElection.id}/questions/create`).send({
      question: "Test question",
      description: "Test description",
      _csrf: csrfToken,
    });

    const groupedQuestionsResponse = await agent
      .get(`/elections/${latestElection.id}/questions`)
      .set("Accept", "application/json");
    const parsedQuestionsGroupedResponse = JSON.parse(
      groupedQuestionsResponse.text
    );
    const questionCount = parsedQuestionsGroupedResponse.questions.length;
    const latestQuestion =
      parsedQuestionsGroupedResponse.questions[questionCount - 1];

    //adding option 1
    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });

    //adding option 2
    res = await agent.get(
      `/elections/${latestElection.id}/questions/${latestQuestion.id}`
    );
    csrfToken = extractCsrfToken(res);
    res = await agent
      .post(`/elections/${latestElection.id}/questions/${latestQuestion.id}`)
      .send({
        _csrf: csrfToken,
        option: "Test option",
      });

    //can edit questions while election is not running
    res = await agent.get(`/elections/${latestElection.id}/questions`);
    expect(res.statusCode).toBe(200);

    res = await agent.get(`/elections/${latestElection.id}/preview`);
    csrfToken = extractCsrfToken(res);
    res = await agent.put(`/elections/${latestElection.id}/launch`).send({
      _csrf: csrfToken,
    });
    const launchedElectionRes = JSON.parse(res.text);
    expect(launchedElectionRes[1][0].running).toBe(true);

    //cannot edit questions while election is running
    res = await agent.get(`/elections/${latestElection.id}/questions`);
    expect(res.statusCode).toBe(302);
  });
});
