"use strict";
const { Model, where } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Election extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */

    static addElection({ electionName, adminID }) {
      return this.create({
        electionName,
        adminID,
      });
    }

    static getElections(adminID) {
      return this.findAll({
        where: {
          adminID,
        },
      });
    }

    static associate(models) {
      // define association here
      Election.belongsTo(models.Admin, {
        foreignKey: "adminID",
      });
    }
  }
  Election.init(
    {
      electionName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    },
    {
      sequelize,
      modelName: "Election",
    }
  );
  return Election;
};
