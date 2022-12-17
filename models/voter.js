"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Voter extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    resetPass(password) {
      return this.update({ password });
    }

    static async createVoter({ voterid, password, electionID }) {
      return await this.create({
        voterid,
        password,
        electionID,
        voted: false,
      });
    }

    static async getNumberOfVoters(electionID) {
      return await this.count({
        where: {
          electionID,
        },
      });
    }

    static async getVoters(electionID) {
      return await this.findAll({
        where: {
          electionID,
        },
        order: [["id", "ASC"]],
      });
    }

    static async getVoter(id) {
      return await this.findOne({
        where: {
          id,
        },
      });
    }

    static async deleteVoter(id) {
      return await this.destroy({
        where: {
          id,
        },
      });
    }

    static associate(models) {
      // define association here
      Voter.belongsTo(models.Election, {
        foreignKey: "electionID",
      });
    }
  }
  Voter.init(
    {
      voterid: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      voted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Voter",
    }
  );
  return Voter;
};
