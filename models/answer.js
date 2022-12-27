"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Answer extends Model {
    static addAnswer({ voterID, electionID, questionID, selectedOption }) {
      return this.create({
        voterID,
        electionID,
        questionID,
        selectedOption,
      });
    }
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Answer.belongsTo(models.Voter, {
        foreignKey: "voterID",
      });
      Answer.belongsTo(models.Election, {
        foreignKey: "electionID",
      });
      Answer.belongsTo(models.Questions, {
        foreignKey: "questionID",
      });
      Answer.belongsTo(models.Options, {
        foreignKey: "selectedOption",
      });
    }
  }
  Answer.init(
    {},
    {
      sequelize,
      modelName: "Answer",
    }
  );
  return Answer;
};
