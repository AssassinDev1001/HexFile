/*
Navicat PGSQL Data Transfer

Source Server         : localhost
Source Server Version : 90606
Source Host           : localhost:5432
Source Database       : hexfiledb
Source Schema         : public

Target Server Type    : PGSQL
Target Server Version : 90606
File Encoding         : 65001

Date: 2018-07-13 20:24:58
*/


-- ----------------------------
-- Sequence structure for scenes_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."scenes_id_seq";
CREATE SEQUENCE "public"."scenes_id_seq"
 INCREMENT 1
 MINVALUE 1
 MAXVALUE 9223372036854775807
 START 302
 CACHE 1;
SELECT setval('"public"."scenes_id_seq"', 302, true);

-- ----------------------------
-- Sequence structure for users_id_seq
-- ----------------------------
DROP SEQUENCE IF EXISTS "public"."users_id_seq";
CREATE SEQUENCE "public"."users_id_seq"
 INCREMENT 1
 MINVALUE 1
 MAXVALUE 9223372036854775807
 START 80
 CACHE 1;
SELECT setval('"public"."users_id_seq"', 80, true);

-- ----------------------------
-- Table structure for common
-- ----------------------------
DROP TABLE IF EXISTS "public"."common";
CREATE TABLE "public"."common" (
"strkey" text COLLATE "default",
"strvalue" text COLLATE "default"
)
WITH (OIDS=FALSE)

;

-- ----------------------------
-- Records of common
-- ----------------------------
INSERT INTO "public"."common" VALUES ('company_mail', 'you@gmail.com');
INSERT INTO "public"."common" VALUES ('mail_password', 'password');

-- ----------------------------
-- Table structure for files
-- ----------------------------
DROP TABLE IF EXISTS "public"."files";
CREATE TABLE "public"."files" (
"id" int8 DEFAULT nextval('scenes_id_seq'::regclass) NOT NULL,
"saved_filename" text COLLATE "default" NOT NULL,
"original_filename" text COLLATE "default" NOT NULL,
"created" timestamptz(6) DEFAULT now() NOT NULL,
"description" text COLLATE "default",
"file_size" int8 DEFAULT 0 NOT NULL,
"file_type" text COLLATE "default",
"download_count" int8 DEFAULT 0,
"icon_path" text COLLATE "default"
)
WITH (OIDS=FALSE)

;

-- ----------------------------
-- Records of files
-- ----------------------------
INSERT INTO "public"."files" VALUES ('296', '1_153143822883620007.jpeg', 'tiger-tiger-baby-tigerfamile-young-39629.jpeg', '2018-07-13 06:30:47.471907+07', '', '704857', 'jpeg', '0', '');
INSERT INTO "public"."files" VALUES ('297', '1_153144530098253115.PNG', 'me.PNG', '2018-07-13 08:28:24.671799+07', '', '671660', 'PNG', '0', '');
INSERT INTO "public"."files" VALUES ('298', '1_153147685628310987.txt', 'cover letter.txt', '2018-07-13 17:14:16.288715+07', '', '1067', 'TXT', '0', '');
INSERT INTO "public"."files" VALUES ('299', '1_153147695873410872.txt', 'New Text Document.txt', '2018-07-13 17:15:58.739215+07', '', '12', 'TXT', '0', '');
INSERT INTO "public"."files" VALUES ('300', '1_153147769241877603.log', 'ipmsg_exception.log', '2018-07-13 17:28:12.425258+07', '', '5247', 'LOG', '0', '');
INSERT INTO "public"."files" VALUES ('301', '1_153148177827268963.jpeg', 'pexels-photo-248797.jpeg', '2018-07-13 18:36:18.275949+07', '', '287743', 'JPEG', '0', '');
INSERT INTO "public"."files" VALUES ('302', '1_153148399807021896.bat', '1.bat', '2018-07-13 19:13:18.110575+07', '', '365', 'BAT', '0', '');

-- ----------------------------
-- Table structure for register
-- ----------------------------
DROP TABLE IF EXISTS "public"."register";
CREATE TABLE "public"."register" (
"username" text COLLATE "default" NOT NULL,
"phone_number" text COLLATE "default",
"created" timestamptz(6) DEFAULT now(),
"email" text COLLATE "default",
"password" text COLLATE "default",
"ref_id" text COLLATE "default",
"ip_address" text COLLATE "default",
"user_agent" text COLLATE "default",
"verify_code" text COLLATE "default",
"check_count" int4 DEFAULT 0
)
WITH (OIDS=FALSE)

;

-- ----------------------------
-- Records of register
-- ----------------------------

-- ----------------------------
-- Table structure for sessions
-- ----------------------------
DROP TABLE IF EXISTS "public"."sessions";
CREATE TABLE "public"."sessions" (
"id" uuid NOT NULL,
"user_id" int8 NOT NULL,
"ip_address" inet NOT NULL,
"user_agent" text COLLATE "default",
"ott" bool DEFAULT false,
"created" timestamptz(6) DEFAULT now() NOT NULL,
"expired" timestamptz(6) DEFAULT (now() + '21 days'::interval) NOT NULL,
"time_zone" text COLLATE "default"
)
WITH (OIDS=FALSE)

;

-- ----------------------------
-- Records of sessions
-- ----------------------------
INSERT INTO "public"."sessions" VALUES ('0c531a13-b1de-4d86-bc7f-a709d0c59a18', '1', '::ffff:192.168.1.120', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36', 'f', '2018-07-12 10:25:22.71699+07', '2018-07-13 19:23:39.880064+07', '');
INSERT INTO "public"."sessions" VALUES ('1de12c04-be8f-43ca-a4a5-21d10ed5ce5f', '2', '::ffff:192.168.1.120', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36', 'f', '2018-07-07 01:12:22.540606+07', '2018-07-28 01:12:22.669+07', '');
INSERT INTO "public"."sessions" VALUES ('25e2e5e4-6ec4-46c2-8efe-f315ab6a2ef6', '1', '::ffff:192.168.1.120', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36', 'f', '2018-07-13 17:27:04.937278+07', '2018-07-13 19:23:39.880064+07', '');
INSERT INTO "public"."sessions" VALUES ('9b711100-71c4-4602-8b39-2b041420f371', '1', '::ffff:192.168.1.120', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36', 'f', '2018-07-13 17:14:04.112646+07', '2018-07-13 19:23:39.880064+07', '');
INSERT INTO "public"."sessions" VALUES ('f1c8ac57-f702-41ec-8f62-833ba2c93d3d', '1', '::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.99 Safari/537.36', 'f', '2018-07-09 01:34:34.415642+07', '2018-07-13 19:23:39.880064+07', '');

-- ----------------------------
-- Table structure for users
-- ----------------------------
DROP TABLE IF EXISTS "public"."users";
CREATE TABLE "public"."users" (
"id" int8 DEFAULT nextval('users_id_seq'::regclass) NOT NULL,
"created" timestamptz(6) DEFAULT now() NOT NULL,
"username" text COLLATE "default" NOT NULL,
"email" text COLLATE "default",
"password" text COLLATE "default" NOT NULL
)
WITH (OIDS=FALSE)

;

-- ----------------------------
-- Records of users
-- ----------------------------
INSERT INTO "public"."users" VALUES ('1', '2018-07-03 14:44:47.361872+07', 'user1', 'jr198612060@gmail.com', 'sha1$9b0108ed$1$8636f8bf0bc90ae0fe5d8bb9b1a0c36735510845');
INSERT INTO "public"."users" VALUES ('2', '2018-07-07 01:12:22.540606+07', 'user2', 'jr19861206@gmail.com', 'sha1$882cc30f$1$611ce0c956251c2c31604f733c83c720ed0c2895');

-- ----------------------------
-- View structure for users_view
-- ----------------------------
CREATE OR REPLACE VIEW "public"."users_view" AS 
 SELECT u.id,
    u.created,
    u.username,
    u.email,
    u.password,
    ( SELECT sessions.time_zone
           FROM sessions
          WHERE ((sessions.time_zone <> ''::text) AND (sessions.user_id = u.id))
          ORDER BY sessions.created DESC
         LIMIT 1) AS time_zone
   FROM users u;

-- ----------------------------
-- Alter Sequences Owned By 
-- ----------------------------
ALTER SEQUENCE "public"."scenes_id_seq" OWNED BY "files"."id";
ALTER SEQUENCE "public"."users_id_seq" OWNED BY "users"."id";

-- ----------------------------
-- Primary Key structure for table files
-- ----------------------------
ALTER TABLE "public"."files" ADD PRIMARY KEY ("id");

-- ----------------------------
-- Primary Key structure for table register
-- ----------------------------
ALTER TABLE "public"."register" ADD PRIMARY KEY ("username");

-- ----------------------------
-- Indexes structure for table sessions
-- ----------------------------
CREATE INDEX "sessions_user_id_idx" ON "public"."sessions" USING btree ("user_id", "expired");

-- ----------------------------
-- Primary Key structure for table sessions
-- ----------------------------
ALTER TABLE "public"."sessions" ADD PRIMARY KEY ("id");

-- ----------------------------
-- Indexes structure for table users
-- ----------------------------
CREATE UNIQUE INDEX "unique_username" ON "public"."users" USING btree (lower(username));
CREATE INDEX "user_id_idx" ON "public"."users" USING btree ("id");
CREATE INDEX "users_email_idx" ON "public"."users" USING btree (lower(email));

-- ----------------------------
-- Primary Key structure for table users
-- ----------------------------
ALTER TABLE "public"."users" ADD PRIMARY KEY ("id");
