"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Questions extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static async getNumberOfQuestions(electionID) {
      return await this.count({
        where: {
          electionID,
        },
      });
    }

    static updateQuestion({ question, description, id }) {
      return this.update(
        {
          question,
          description,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static addQuestion({ question, description, electionID }) {
      return this.create({
        question,
        description,
        electionID,
      });
    }

    static async getQuestion(id) {
      return await this.findOne({
        where: {
          id,
        },
      });
    }

    static deleteQuestion(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static async getQuestions(electionID) {
      return await this.findAll({
        where: {
          electionID,
        },
        order: [["id", "ASC"]],
      });
    }

    static associate(models) {
      // define association here
      Questions.belongsTo(models.Election, {
        foreignKey: "electionID",
        onDelete: "CASCADE",
      });

      Questions.hasMany(models.Options, {
        foreignKey: "questionID",
        onDelete: "CASCADE",
      });

      Questions.hasMany(models.Answer, {
        foreignKey: "questionID",
        onDelete: "CASCADE",
      });
    }
  }
  Questions.init(
    {
      question: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
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
