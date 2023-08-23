import "dotenv/config";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as go from "@aws-cdk/aws-lambda-go-alpha";

const HEROKU_APP_NAME = process.env.HEROKU_APP_NAME as string;
const HEROKU_API_TOKEN = process.env.HEROKU_API_TOKEN as string;
const EVENTBRIDGE_CRON_EXPRESSION_ON = process.env.EVENTBRIDGE_CRON_EXPRESSION_ON as string;
const EVENTBRIDGE_CRON_EXPRESSION_OFF = process.env.EVENTBRIDGE_CRON_EXPRESSION_OFF as string;
const TIME_ZONE = process.env.TIME_ZONE as string;

export class HerokuFormationUpdaterStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const schedulerRole = new cdk.aws_iam.Role(this, "schedulerRole", {
      assumedBy: new cdk.aws_iam.ServicePrincipal("scheduler.amazonaws.com"),
    });

    const goLambda = new go.GoFunction(this, "handler", {
      entry: "lambda-app/cmd",
      timeout: cdk.Duration.seconds(5),
      retryAttempts: 2,
      bundling: {
        assetHashType: cdk.AssetHashType.SOURCE,
      },
      environment: {
        HEROKU_APP_NAME: HEROKU_APP_NAME,
        HEROKU_API_TOKEN: HEROKU_API_TOKEN,
      },
    });

    const invokeLambdaPolicy = new cdk.aws_iam.Policy(this, "invokeLambdaPolicy", {
      document: new cdk.aws_iam.PolicyDocument({
        statements: [
          new cdk.aws_iam.PolicyStatement({
            actions: ["lambda:InvokeFunction"],
            resources: [goLambda.functionArn],
            effect: cdk.aws_iam.Effect.ALLOW,
          }),
        ],
      }),
    });

    schedulerRole.attachInlinePolicy(invokeLambdaPolicy);

    new cdk.CfnResource(this, "herokuFormationOn", {
      type: "AWS::Scheduler::Schedule",
      properties: {
        Name: "herokuFormationOn",
        Description: "Turns heroku formation to 1 (on)",
        FlexibleTimeWindow: { Mode: "OFF" },
        ScheduleExpression: `cron(${EVENTBRIDGE_CRON_EXPRESSION_ON})`,
        ScheduleExpressionTimezone: TIME_ZONE,
        Target: {
          Arn: goLambda.functionArn,
          RoleArn: schedulerRole.roleArn,
          Input: JSON.stringify({ action: "on" }),
        },
      },
    });

    new cdk.CfnResource(this, "herokuFormationOff", {
      type: "AWS::Scheduler::Schedule",
      properties: {
        Name: "herokuFormationOff",
        Description: "Turns heroku formation to 0 (off)",
        FlexibleTimeWindow: { Mode: "OFF" },
        ScheduleExpression: `cron(${EVENTBRIDGE_CRON_EXPRESSION_OFF})`,
        ScheduleExpressionTimezone: TIME_ZONE,
        Target: {
          Arn: goLambda.functionArn,
          RoleArn: schedulerRole.roleArn,
          Input: JSON.stringify({ action: "off" }),
        },
      },
    });
  }
}
