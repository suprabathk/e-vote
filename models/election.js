"use strict";
const { Model, where } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Election extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    static addElection({ electionName, adminID, urlString }) {
      return this.create({
        electionName,
        urlString,
        adminID,
      });
    }

    static launchElection(id) {
      return this.update(
        {
          running: true,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static endElection(id) {
      return this.update(
        {
          running: false,
          ended: true,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static getElections(adminID) {
      return this.findAll({
        where: {
          adminID,
        },
        order: [["id", "ASC"]],
      });
    }

    static getElection(id) {
      return this.findOne({
        where: {
          id,
        },
      });
    }

    static getElectionURL(urlString) {
      return this.findOne({
        where: {
          urlString,
        },
      });
    }

    static updateElection({ urlString, electionName, id }) {
      return this.update(
        {
          urlString,
          electionName,
        },
        {
          returning: true,
          where: {
            id,
          },
        }
      );
    }

    static deleteElection(id) {
      return this.destroy({
        where: {
          id,
        },
      });
    }

    static associate(models) {
      // define association here
      Election.belongsTo(models.Admin, {
        foreignKey: "adminID",
      });

      Election.hasMany(models.Questions, {
        foreignKey: "electionID",
        onDelete: "CASCADE",
      });

      Election.hasMany(models.Voter, {
        foreignKey: "electionID",
        onDelete: "CASCADE",
      });

      Election.hasMany(models.Answer, {
        foreignKey: "electionID",
        onDelete: "CASCADE",
      });
    }
  }
  Election.init(
    {
      electionName: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
      urlString: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notNull: true,
        },
      },
      running: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      ended: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
