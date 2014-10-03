CREATE TABLE `areas` (
  `area_id` smallint NOT NULL AUTO_INCREMENT,
  `projectname` varchar(80) NOT NULL,
  `lead` varchar(80) NOT NULL,
  PRIMARY KEY (`area_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `projects` (
  `project_id` int NOT NULL AUTO_INCREMENT,
  `area_id` smallint DEFAULT NULL,
  `last_change` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `priority` float DEFAULT NULL,
  `bugid` int DEFAULT NULL,
  `bugsync` BOOL NOT NULL,
  `summary` varchar(255) NOT NULL,
  `owner` varchar(80) DEFAULT NULL,
  `notes` text NOT NULL,
  `complete` BOOL NOT NULL,
  PRIMARY KEY (`project_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;

CREATE TABLE `stages` (
  `stage_id` smallint NOT NULL AUTO_INCREMENT,
  `priority` float NOT NULL,
  `name` varchar(80) NOT NULL,
  PRIMARY KEY (`stage_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
