"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("Elections", "adminID", {
      type: Sequelize.DataTypes.INTEGER,
    });
    await queryInterface.addConstraint("Elections", {
      fields: ["adminID"],
      type: "foreign key",
      references: {
        table: "Admins",
        field: "id",
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("Elections", "adminID");
  },
};
