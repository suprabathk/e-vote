"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Questions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static getNumberOfQuestions(electionID) {
      return this.count({
        where: {
          electionID,
        },
      });
    }

    static addQuestion({ question, description, electionID }) {
      return this.create({
        question,
        description,
        electionID,
      });
    }

    static getQuestions(electionID) {
      return this.findAll({
        where: {
          electionID,
        },
      });
    }

    static associate(models) {
      // define association here
      Questions.belongsTo(models.Election, {
        foreignKey: "electionID",
      });
    }
  }
  Questions.init(
    {
      question: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      description: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Questions",
    }
  );
  return Questions;
};
