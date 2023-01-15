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

    static async markAsVoted(id) {
      return await this.update(
        {
          voted: true,
        },
        {
          where: {
            id,
          },
        }
      );
    }

    static async getNumberOfVoters(electionID) {
      return await this.count({
        where: {
          electionID,
        },
      });
    }

    static async countVoted(electionID) {
      return await this.count({
        where: {
          electionID,
          voted: true,
        },
      });
    }

    static async countVotePending(electionID) {
      return await this.count({
        where: {
          electionID,
          voted: false,
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
        onDelete: "CASCADE",
      });

      Voter.hasMany(models.Answer, {
        foreignKey: "voterID",
        onDelete: "CASCADE",
      });
    }
  }
  Voter.init(
    {
      voterid: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notNull: true,
        },
      },
      role: {
        type: DataTypes.STRING,
        defaultValue: "voter",
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
      voted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        validate: {
          notNull: true,
        },
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
